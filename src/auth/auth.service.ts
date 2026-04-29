import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserEntity } from 'src/users/user.entity';
import { UserService } from 'src/users/user.service';
import { AppConfigService } from 'src/config/app-config.service';
import { Request } from 'express';
import {
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_PKCE_TRANSACTION_TTL_MS,
} from './auth.config';
import {
  buildGithubAuthUrl,
  generatePkcePair,
  generateState,
} from './pkce.util';
import { TokenService } from './token.service';

type AuthMode = 'web' | 'cli';

interface GithubLoginTransaction {
  state: string;
  codeVerifier: string;
  createdAt: Date;
  mode: AuthMode;
}

interface GithubUserPayload {
  id: number;
  login: string;
  email?: string | null;
  avatar_url?: string | null;
}

interface GithubEmailPayload {
  email: string;
  primary: boolean;
  verified: boolean;
}

@Injectable()
export class AuthService {
  private readonly githubTransactions = new Map<
    string,
    GithubLoginTransaction
  >();

  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly configService: AppConfigService,
  ) {}

  private cleanupExpiredTransactions(): void {
    const now = Date.now();

    for (const [state, transaction] of this.githubTransactions.entries()) {
      if (
        now - transaction.createdAt.getTime() >
        AUTH_PKCE_TRANSACTION_TTL_MS
      ) {
        this.githubTransactions.delete(state);
      }
    }
  }

  beginGithubLogin(mode: AuthMode = 'web'): { authUrl: string; state: string } {
    this.cleanupExpiredTransactions();

    const githubClientId = this.configService.githubClientId;
    const backendUrl = this.configService.backendUrl;

    if (!githubClientId || !backendUrl) {
      throw new BadRequestException('OAuth configuration is missing');
    }

    const state = generateState();
    const { codeVerifier, codeChallenge } = generatePkcePair();

    this.githubTransactions.set(state, {
      state,
      codeVerifier,
      createdAt: new Date(),
      mode,
    });

    return {
      state,
      authUrl: buildGithubAuthUrl({
        clientId: githubClientId,
        redirectUri: `${backendUrl.replace(/\/$/, '')}/auth/github/callback`,
        state,
        codeChallenge,
      }),
    };
  }

  private consumeTransaction(state: string): GithubLoginTransaction {
    this.cleanupExpiredTransactions();

    const transaction = this.githubTransactions.get(state);
    if (!transaction) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Invalid or expired OAuth state',
      });
    }

    this.githubTransactions.delete(state);
    return transaction;
  }

  private async fetchGithubUser(
    accessToken: string,
  ): Promise<GithubUserPayload> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch GitHub user profile');
    }

    return (await response.json()) as GithubUserPayload;
  }

  private async fetchGithubPrimaryEmail(
    accessToken: string,
  ): Promise<string | null> {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      return null;
    }

    const emails = (await response.json()) as GithubEmailPayload[];
    return (
      emails.find((email) => email.primary && email.verified)?.email ?? null
    );
  }

  peekTransactionMode(state: string): AuthMode | undefined {
    return this.githubTransactions.get(state)?.mode;
  }

  async completeGithubCallback(options: {
    code: string;
    state: string;
  }): Promise<{
    mode: AuthMode;
    user: UserEntity;
    accessToken: string;
    refreshToken: string;
  }> {
    const transaction = this.consumeTransaction(options.state);
    const githubClientId = this.configService.githubClientId;
    const githubClientSecret = this.configService.githubClientSecret;
    const backendUrl = this.configService.backendUrl;

    if (!githubClientId || !githubClientSecret || !backendUrl) {
      throw new BadRequestException('OAuth configuration is missing');
    }

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: githubClientId,
          client_secret: githubClientSecret,
          code: options.code,
          code_verifier: transaction.codeVerifier,
          redirect_uri: `${backendUrl.replace(/\/$/, '')}/auth/github/callback`,
        }),
      },
    );

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('GitHub code exchange failed');
    }

    const tokenBody = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenBody.access_token) {
      throw new UnauthorizedException(
        tokenBody.error ?? 'GitHub access token was not returned',
      );
    }

    const githubProfile = await this.fetchGithubUser(tokenBody.access_token);
    const email = await this.fetchGithubPrimaryEmail(tokenBody.access_token);

    const user = await this.userService.createOrUpdateFromGithubProfile({
      github_id: githubProfile.id.toString(),
      username: githubProfile.login,
      email,
      avatar_url: githubProfile.avatar_url ?? null,
    });

    const accessToken = this.tokenService.signAccessToken({
      userId: user.id,
      role: user.role,
      githubId: user.github_id,
      username: user.username,
    });

    const refreshToken = this.tokenService.generateRefreshToken();
    await this.tokenService.storeRefreshToken({
      userId: user.id,
      refreshToken,
    });

    return {
      mode: transaction.mode,
      user,
      accessToken,
      refreshToken,
    };
  }

  async refreshSession(refreshToken: string): Promise<{
    user: UserEntity;
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenRecord =
      await this.tokenService.validateRefreshToken(refreshToken);

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.userService.findById(tokenRecord.user_id);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User is not active');
    }

    const nextRefreshToken = this.tokenService.generateRefreshToken();

    await this.tokenService.rotateRefreshToken({
      userId: user.id,
      oldRefreshToken: refreshToken,
      newRefreshToken: nextRefreshToken,
    });

    return {
      user,
      accessToken: this.tokenService.signAccessToken({
        userId: user.id,
        role: user.role,
        githubId: user.github_id,
        username: user.username,
      }),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<boolean> {
    return await this.tokenService.invalidateRefreshToken(refreshToken);
  }

  getCurrentUserFromAccessToken(accessToken: string) {
    try {
      return this.tokenService.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized',
      });
    }
  }

  getTokenFromRequest(request: Request): string | null {
    const headerToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : null;

    if (headerToken) {
      return headerToken;
    }

    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((pair) => {
        const [key, ...valueParts] = pair.trim().split('=');
        return [key, decodeURIComponent(valueParts.join('='))];
      }),
    );

    return cookies[AUTH_COOKIE_NAME] ?? null;
  }

  getRefreshTokenFromRequest(
    request: Request,
    bodyToken?: string,
  ): string | null {
    if (bodyToken) {
      return bodyToken;
    }

    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((pair) => {
        const [key, ...valueParts] = pair.trim().split('=');
        return [key, decodeURIComponent(valueParts.join('='))];
      }),
    );

    return cookies[AUTH_REFRESH_COOKIE_NAME] ?? null;
  }
}

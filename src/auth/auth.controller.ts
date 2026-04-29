import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_COOKIE_NAME, AUTH_REFRESH_COOKIE_NAME } from './auth.config';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

function cookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    secure: isProd,
    path: '/',
    maxAge,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async beginGithubLogin(
    @Query('mode') mode: 'web' | 'cli' | undefined,
    @Query('redirect_uri') redirectUriEncoded: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    let redirectUri: string | undefined;
    if (redirectUriEncoded) {
      try {
        redirectUri = decodeURIComponent(redirectUriEncoded);
      } catch {
        redirectUri = redirectUriEncoded;
      }
    }

    const result = this.authService.beginGithubLogin(
      mode ?? 'web',
      redirectUri,
    );

    if (mode === 'cli') {
      response.status(200).json(result);
      return;
    }

    response.redirect(result.authUrl);
  }

  @Get('github/callback')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async completeGithubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('mode') mode: 'web' | 'cli' | undefined,
    @Res() response: Response,
  ): Promise<Response | void> {
    if (!code || !state) {
      throw new UnauthorizedException('Missing OAuth callback parameters');
    }

    const modeFromCallBack = this.authService.peekTransactionMode(state);

    if (modeFromCallBack === 'cli') {
      return response.redirect(
        `http://localhost:9876?code=${code}&state=${state}`,
      );
    }

    const result = await this.authService.completeGithubCallback({
      code,
      state,
    });

    const callbackMode = mode ?? result.mode;

    if (callbackMode === 'cli') {
      return response.status(200).json({
        status: 'success',
        data: {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          user: result.user,
        },
      });
    }

    response.cookie(
      AUTH_COOKIE_NAME,
      result.accessToken,
      cookieOptions(3 * 60 * 1000),
    );
    response.cookie(
      AUTH_REFRESH_COOKIE_NAME,
      result.refreshToken,
      cookieOptions(5 * 60 * 1000),
    );

    if (result.redirectUri) {
      return response.redirect(result.redirectUri);
    }

    return response.status(200).json({
      status: 'success',
      data: {
        user: result.user,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      },
    });
  }

  @Post('github/cli-exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async cliExchange(@Body() body: { code: string; state: string }) {
    const result = await this.authService.completeGithubCallback(body);

    return {
      status: 'success',
      data: {
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        user: result.user,
      },
    };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refreshSession(
    @Body('refresh_token') refreshToken: string | undefined,
    @Req() request: Request,
    @Query('mode') mode: 'web' | 'cli' | undefined,
    @Res() response: Response,
  ): Promise<Response> {
    const token = this.authService.getRefreshTokenFromRequest(
      request,
      refreshToken,
    );

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshSession(token);

    if ((mode ?? 'web') === 'cli') {
      return response.status(200).json({
        status: 'success',
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
    }

    response.cookie(
      AUTH_COOKIE_NAME,
      result.accessToken,
      cookieOptions(3 * 60 * 1000),
    );
    response.cookie(
      AUTH_REFRESH_COOKIE_NAME,
      result.refreshToken,
      cookieOptions(5 * 60 * 1000),
    );

    return response.status(200).json({
      status: 'success',
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
  }

  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async logout(
    @Body('refresh_token') refreshToken: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<Response> {
    const token = this.authService.getRefreshTokenFromRequest(
      request,
      refreshToken,
    );

    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    await this.authService.logout(token);
    response.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, { path: '/' });

    return response.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  }

  @Get('me')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  getMe(@Req() request: Request) {
    const token = this.authService.getTokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    const claims = this.authService.getCurrentUserFromAccessToken(token);

    return {
      status: 'success',
      data: {
        id: claims.sub,
        role: claims.role,
        github_id: claims.githubId,
        username: claims.username,
      },
    };
  }
}

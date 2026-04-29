import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { MoreThan, Repository, LessThan } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  AUTH_ACCESS_TOKEN_TTL_MS,
  AUTH_REFRESH_TOKEN_TTL_MS,
  getAuthEnv,
} from './auth.config';
import { RefreshTokenEntity } from './token.entity';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  role: 'admin' | 'analyst';
  githubId: string;
  username: string;
}

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokenRepository: Repository<RefreshTokenEntity>,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  buildExpiry(ms: number = AUTH_REFRESH_TOKEN_TTL_MS): Date {
    return new Date(Date.now() + ms);
  }

  signAccessToken(claims: {
    userId: string;
    role: 'admin' | 'analyst';
    githubId: string;
    username: string;
  }): string {
    const { jwtSecret } = getAuthEnv();

    return sign(
      {
        sub: claims.userId,
        role: claims.role,
        githubId: claims.githubId,
        username: claims.username,
      },
      jwtSecret,
      {
        expiresIn: Math.floor(AUTH_ACCESS_TOKEN_TTL_MS / 1000),
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const { jwtSecret } = getAuthEnv();
    return verify(token, jwtSecret) as AccessTokenClaims;
  }

  async storeRefreshToken(options: {
    userId: string;
    refreshToken: string;
    expiresAt?: Date;
  }): Promise<RefreshTokenEntity> {
    const token = this.tokenRepository.create({
      id: uuidv7(),
      user_id: options.userId,
      refresh_token_hash: this.hashToken(options.refreshToken),
      expires_at: options.expiresAt ?? this.buildExpiry(),
      is_invalidated: false,
    });

    return await this.tokenRepository.save(token);
  }

  async validateRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenEntity | null> {
    const tokenHash = this.hashToken(refreshToken);

    return await this.tokenRepository.findOne({
      where: {
        refresh_token_hash: tokenHash,
        is_invalidated: false,
        expires_at: MoreThan(new Date()),
      },
    });
  }

  async invalidateRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(refreshToken);
    const result = await this.tokenRepository.update(
      { refresh_token_hash: tokenHash },
      { is_invalidated: true },
    );

    return (result.affected ?? 0) > 0;
  }

  async rotateRefreshToken(options: {
    userId: string;
    oldRefreshToken: string;
    newRefreshToken: string;
    expiresAt?: Date;
  }): Promise<RefreshTokenEntity> {
    await this.invalidateRefreshToken(options.oldRefreshToken);

    return await this.storeRefreshToken({
      userId: options.userId,
      refreshToken: options.newRefreshToken,
      expiresAt: options.expiresAt,
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenRepository.delete({
      expires_at: LessThan(new Date()),
    });

    return result.affected ?? 0;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get githubClientId(): string {
    return this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
  }

  get githubClientSecret(): string {
    return this.configService.getOrThrow<string>('GITHUB_CLIENT_SECRET');
  }

  get jwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  get backendUrl(): string {
    return this.configService.getOrThrow<string>('BACKEND_URL');
  }

  get webPortalUrl(): string {
    return this.configService.getOrThrow<string>('WEB_PORTAL_URL');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 8000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get cliCallbackPort(): number {
    return this.configService.get<number>('CLI_CALLBACK_PORT', 9876);
  }

  logConfig(): void {
    console.log('[AppConfigService] Configuration loaded:', {
      githubClientId: this.githubClientId
        ? `${this.githubClientId.slice(0, 10)}...`
        : 'MISSING',
      githubClientSecret: this.githubClientSecret ? 'SET' : 'MISSING',
      jwtAccessSecret: this.jwtAccessSecret ? 'SET' : 'MISSING',
      backendUrl: this.backendUrl,
      webPortalUrl: this.webPortalUrl,
      port: this.port,
      nodeEnv: this.nodeEnv,
    });
  }
}

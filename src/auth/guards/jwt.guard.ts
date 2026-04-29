import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.authService.getTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized',
      });
    }

    try {
      const claims = this.authService.getCurrentUserFromAccessToken(token);

      request.user = {
        sub: claims.sub,
        role: claims.role,
        githubId: claims.githubId,
        username: claims.username,
      };

      return true;
    } catch (error) {
      if (
        error instanceof TokenExpiredError ||
        error instanceof JsonWebTokenError ||
        error instanceof NotBeforeError
      ) {
        throw new UnauthorizedException({
          status: 'error',
          message: 'Unauthorized',
        });
      }

      throw error;
    }
  }
}

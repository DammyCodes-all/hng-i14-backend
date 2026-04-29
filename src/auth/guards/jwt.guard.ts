import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
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

    const claims = this.authService.getCurrentUserFromAccessToken(token);
    if (!claims) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized',
      });
    }

    request.user = {
      sub: claims.sub,
      role: claims.role,
      githubId: claims.githubId,
      username: claims.username,
    };

    return true;
  }
}

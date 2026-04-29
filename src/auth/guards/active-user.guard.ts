import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserService } from 'src/users/user.service';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.sub;

    if (!userId) {
      return false;
    }

    const user = await this.userService.findById(userId);
    if (!user || !user.is_active) {
      throw new ForbiddenException({
        status: 'error',
        message: 'User account is inactive',
      });
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException({
        status: 'error',
        message: 'Access denied',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userRole = request.user?.role as UserRole;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        status: 'error',
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}

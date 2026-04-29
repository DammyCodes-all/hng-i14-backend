import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiVersionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const version = request.headers['x-api-version'];

    if (!version || version !== '1') {
      throw new BadRequestException({
        status: 'error',
        message: 'API version header required',
      });
    }

    return true;
  }
}

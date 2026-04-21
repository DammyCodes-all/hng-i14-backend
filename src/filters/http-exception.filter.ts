import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (
        status === HttpStatus.BAD_REQUEST &&
        typeof raw === 'object' &&
        raw !== null &&
        Array.isArray((raw as Record<string, unknown>).message)
      ) {
        response.status(status).json({
          status: 'error',
          message: 'Invalid query parameters',
        });
        return;
      }

      if (typeof raw === 'object' && raw !== null) {
        const body = raw as Record<string, unknown>;

        if (body.status === 'error') {
          response.status(status).json(body);
          return;
        }

        response.status(status).json({
          status: 'error',
          message:
            typeof body.message === 'string' ? body.message : exception.message,
        });
        return;
      }

      response.status(status).json({
        status: 'error',
        message: typeof raw === 'string' ? raw : exception.message,
      });
      return;
    }

    console.error('[GlobalExceptionFilter] unhandled exception:', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
}

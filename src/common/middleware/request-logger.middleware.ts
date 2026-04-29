import { Injectable, NestMiddleware } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';
import { InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(@InjectPinoLogger() private readonly logger: Logger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const start = Date.now();

    response.on('finish', () => {
      const durationMs = Date.now() - start;
      const authHeader = request.headers.authorization;
      const userHint = authHeader?.startsWith('Bearer ')
        ? 'authenticated'
        : 'anonymous';

      this.logger?.log(
        {
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs,
          user: userHint,
          ip: request.ip,
        },
        'HTTP Request',
      );
    });

    next();
  }
}

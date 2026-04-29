import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const start = Date.now();

    response.on('finish', () => {
      const durationMs = Date.now() - start;
      const authHeader = request.headers.authorization;
      const userHint = authHeader?.startsWith('Bearer ')
        ? 'authenticated'
        : 'anonymous';

      console.log(
        JSON.stringify({
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs,
          user: userHint,
          ip: request.ip,
          timestamp: new Date().toISOString(),
        }),
      );
    });

    next();
  }
}

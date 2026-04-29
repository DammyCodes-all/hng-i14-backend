import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from './config/app-config.service';

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:5173',
    'https://insighta-web-portal-ten.vercel.app',
  ]);

  if (config.webPortalUrl) {
    allowedOrigins.add(normalizeOrigin(config.webPortalUrl));
  }

  if (config.backendUrl) {
    allowedOrigins.add(normalizeOrigin(config.backendUrl));
  }

  app.enableCors({
    origin: Array.from(allowedOrigins),
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { UsersModule } from './users/users.module';
import { AppConfigModule } from './config/app-config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub as string | undefined;
    return userId ?? (req.ip as string) ?? 'unknown';
  }

  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return `${name}-${context.getClass().name}-${context.getHandler().name}-${suffix}`;
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  ignore: 'pid,hostname,req.headers,req.remoteAddress,req.remotePort,res.headers',
                  messageFormat: '{levelLabel} {msg}',
                },
              },
      },
    }),
    AppConfigModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 60,
        },
      ],
    }),
    AuthModule,
    ProfileModule,
    UsersModule,
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      synchronize: true,
      database: 'db/database.db',
      autoLoadEntities: true,
    }),
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}

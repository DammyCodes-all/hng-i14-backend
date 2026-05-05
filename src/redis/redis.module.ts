import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppConfigService } from 'src/config/app-config.service';

@Module({
  providers: [RedisService, AppConfigService],
  exports: [RedisService],
})
export class RedisModule {}

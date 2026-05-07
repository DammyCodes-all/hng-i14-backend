import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileImportService } from './profile-import.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from './profile.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import {
  ActiveUserGuard,
  ApiVersionGuard,
  JwtGuard,
  RolesGuard,
} from 'src/auth/guards';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    RedisModule,
    TypeOrmModule.forFeature([ProfileEntity]),
  ],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    ProfileImportService,
    JwtGuard,
    ActiveUserGuard,
    ApiVersionGuard,
    RolesGuard,
  ],
  exports: [TypeOrmModule],
})
export class ProfileModule {}

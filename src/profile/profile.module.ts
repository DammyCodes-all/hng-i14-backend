import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from './profile.entity';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';
import { ActiveUserGuard, ApiVersionGuard, JwtGuard, RolesGuard } from 'src/auth/guards';

@Module({
  imports: [AuthModule, UsersModule, TypeOrmModule.forFeature([ProfileEntity])],
  controllers: [ProfileController],
  providers: [ProfileService, JwtGuard, ActiveUserGuard, ApiVersionGuard, RolesGuard],
  exports: [TypeOrmModule],
})
export class ProfileModule {}

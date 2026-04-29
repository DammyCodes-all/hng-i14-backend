import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenEntity } from './token.entity';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([RefreshTokenEntity])],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [AuthService, TokenService, TypeOrmModule],
})
export class AuthModule {}

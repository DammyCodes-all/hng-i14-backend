import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './token.entity';
import { TokenService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshTokenEntity])],
  providers: [TokenService],
  exports: [TokenService, TypeOrmModule],
})
export class AuthModule {}

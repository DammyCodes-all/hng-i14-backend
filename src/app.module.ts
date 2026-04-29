import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
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
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

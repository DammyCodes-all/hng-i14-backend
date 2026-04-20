import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfileModule } from './profile/profile.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ProfileModule,
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

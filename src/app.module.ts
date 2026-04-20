import { Module } from '@nestjs/common';
import { ClassifyModule } from './classify/classify.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfileModule } from './profile/profile.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from './profile/profile.entity';

@Module({
  imports: [
    ClassifyModule,
    ProfileModule,
    TypeOrmModule.forRoot({
      type: 'sqlite',
      synchronize: true,
      database: 'db/database.db',
      entities: [ProfileEntity],
      logging: true,
    }),
  ],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

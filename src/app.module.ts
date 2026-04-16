import { Module } from '@nestjs/common';
import { ClassifyModule } from './classify/classify.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [ClassifyModule, ProfileModule],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

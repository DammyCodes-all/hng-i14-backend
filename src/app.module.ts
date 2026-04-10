import { Module } from '@nestjs/common';
import { ClassifyModule } from './classify/classify.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ClassifyModule],
  providers: [AppService],
  controllers: [AppController],
})
export class AppModule {}

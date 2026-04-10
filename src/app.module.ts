import { Module } from '@nestjs/common';
import { ClassifyModule } from './classify/classify.module';

@Module({
  imports: [ClassifyModule],
})
export class AppModule {}

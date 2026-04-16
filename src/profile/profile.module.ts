import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileStoreService } from './profile-store.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ProfileStoreService],
})
export class ProfileModule {}

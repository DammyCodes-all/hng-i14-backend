import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  Delete,
} from '@nestjs/common';
import { CreateProfileDto } from '../dto/profile';
import { ProfileService } from './profile.service';

@Controller('api/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  async createProfile(@Body() createProfileDto: CreateProfileDto) {
    return await this.profileService.createProfile(createProfileDto);
  }

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Get()
  getAllProfiles() {
    return this.profileService.getAllProfiles();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProfile(@Param('id') id: string) {
    return this.profileService.deleteProfile(id);
  }
}

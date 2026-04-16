import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  Delete,
  ParseUUIDPipe,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import type { UUID } from 'crypto';

@Controller('api/profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  async createProfile(@Body() createProfileDto: { name: string }) {
    if (typeof createProfileDto.name !== 'string') {
      throw new HttpException(
        'Unprocessable Entity: Invalid type',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!createProfileDto.name) {
      throw new HttpException(
        'Bad Request: Missing or empty namw',
        HttpStatus.BAD_REQUEST,
      );
    }
    return await this.profileService.createProfile(createProfileDto);
  }

  @Get(':id')
  getProfile(@Param('id', ParseUUIDPipe) id: UUID) {
    try {
      return this.profileService.getProfile(id);
    } catch (error) {
      console.error(error);
      throw new NotFoundException({
        status: 'error',
        message: 'Not Found: Profile not found',
      });
    }
  }

  @Get()
  getAllProfiles(
    @Param('gender') gender: string,
    @Param('country_id') country_id: string,
    @Param('age_group') age_group: string,
  ) {
    return this.profileService.getAllProfiles(
      gender.toLowerCase(),
      country_id.toUpperCase(),
      age_group.toLowerCase(),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProfile(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.profileService.deleteProfile(id);
  }
}

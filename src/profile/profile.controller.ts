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
  Query,
  ParseIntPipe,
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
        'Bad Request: Missing or empty name',
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
    @Query('gender') gender?: string,
    @Query('country_id') country_id?: string,
    @Query('age_group') age_group?: string,
    @Query('min_age', ParseIntPipe) min_age?: number,
    @Query('max_age', ParseIntPipe) max_age?: number,
    @Query('min_gender_probability', ParseIntPipe)
    min_gender_probability?: number,
    @Query('min_country_probability', ParseIntPipe)
    min_country_probability?: number,
    @Query('sort_by') sort_by?: string,
    @Query('order') order?: string,
  ) {
    return this.profileService.getAllProfiles(
      gender?.toLowerCase(),
      country_id?.toUpperCase(),
      age_group?.toLowerCase(),
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by?.toLowerCase(),
      order?.toLowerCase(),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProfile(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.profileService.deleteProfile(id);
  }
}

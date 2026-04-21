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
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import type { UUID } from 'crypto';
import { GetAllProfileQueryDto } from './dto/profile.dto';

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

  @Get('search')
  searchProfiles(@Query() query: { q: string }) {
    return this.profileService.naturalLanguageSearch(query.q);
  }

  @Get()
  getAllProfiles(@Query() query: GetAllProfileQueryDto) {
    return this.profileService.getAllProfiles(query);
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProfile(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.profileService.deleteProfile(id);
  }
}

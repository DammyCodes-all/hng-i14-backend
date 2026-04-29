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
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import type { UUID } from 'crypto';
import { GetAllProfileQueryDto, SearchProfileDto } from './dto/profile.dto';
import { ActiveUserGuard, ApiVersionGuard, JwtGuard, RolesGuard } from 'src/auth/guards';
import { Roles } from 'src/auth/decorators';

@UseGuards(JwtGuard, ActiveUserGuard, ApiVersionGuard, RolesGuard)
@Controller('api/profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @Roles('admin')
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
  @Roles('admin', 'analyst')
  searchProfiles(@Query() query: SearchProfileDto) {
    return this.profileService.naturalLanguageSearch(query);
  }

  @Get()
  @Roles('admin', 'analyst')
  getAllProfiles(@Query() query: GetAllProfileQueryDto) {
    return this.profileService.getAllProfiles(query);
  }

  @Get(':id')
  @Roles('admin', 'analyst')
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
  @Roles('admin')
  deleteProfile(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.profileService.deleteProfile(id);
  }
}

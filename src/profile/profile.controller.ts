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
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { Request } from 'express';
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

  @Get('export')
  @Roles('admin', 'analyst')
  async exportProfiles(@Query() query: GetAllProfileQueryDto): Promise<StreamableFile> {
    const profiles = await this.profileService.getAllProfilesForCsv(query);
    const csv = this.profileService.generateCsv(profiles);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const buffer = Buffer.from(csv, 'utf-8');
    return new StreamableFile(buffer, {
      type: 'text/csv',
      disposition: `attachment; filename="profiles-${timestamp}.csv"`,
    });
  }

  @Get()
  @Roles('admin', 'analyst')
  getAllProfiles(@Query() query: GetAllProfileQueryDto, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    return this.profileService.getAllProfiles(query, baseUrl);
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

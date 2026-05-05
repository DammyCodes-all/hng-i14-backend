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
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { ProfileImportService } from './profile-import.service';
import type { UUID } from 'crypto';
import { GetAllProfileQueryDto, SearchProfileDto } from './dto/profile.dto';
import {
  ActiveUserGuard,
  ApiVersionGuard,
  JwtGuard,
  RolesGuard,
} from 'src/auth/guards';
import { Roles } from 'src/auth/decorators';
import { join } from 'path';
import { Readable } from 'stream';

@UseGuards(JwtGuard, ActiveUserGuard, ApiVersionGuard, RolesGuard)
@Controller('api/profiles')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly profileImportService: ProfileImportService,
  ) {}

  @Post('import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException({
        status: 'error',
        message: 'Missing file. Please upload a CSV file as form field `file`.',
      });
    }

    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      throw new BadRequestException({
        status: 'error',
        message: 'Only CSV files are accepted',
      });
    }

    const stream = Readable.from(file.buffer);

    return await this.profileImportService.importCsvStream(stream);
  }

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
  searchProfiles(@Query() query: SearchProfileDto, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    return this.profileService.naturalLanguageSearch(query, baseUrl);
  }

  @Get('export')
  @Roles('admin', 'analyst')
  async exportProfiles(
    @Query() query: GetAllProfileQueryDto,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    if (format !== 'csv') {
      throw new BadRequestException({
        status: 'error',
        message: 'Only format=csv is supported',
      });
    }

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

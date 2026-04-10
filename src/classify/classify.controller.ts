import { Controller, Get, HttpException, Query } from '@nestjs/common';

import { NormalizedResponse } from '../types';
import { ClassifyService } from './classify.service';

@Controller('classify')
export class ClassifyController {
  constructor(private readonly classifyService: ClassifyService) {}

  @Get()
  async classifyName(@Query('name') name: string): Promise<NormalizedResponse> {
    if (!name.trim())
      throw new HttpException(
        {
          status: 'error',
          message: 'Bad Request: Missing or empty name parameter',
        },
        400,
      );

    if (typeof name !== 'string')
      throw new HttpException(
        {
          status: 'error',
          message: 'Unprocessable Entity: Invalid name parameter',
        },
        422,
      );
    try {
      const result = await this.classifyService.classifyName(name);
      return result;
    } catch (error) {
      throw new HttpException(
        { status: 'error', message: 'Upstream Error or server failure' },
        500,
      );
    }
  }
}

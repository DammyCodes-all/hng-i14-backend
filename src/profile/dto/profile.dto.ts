import {
  IsIn,
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetAllProfileQueryDto {
  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  country_id?: string;

  @IsOptional()
  @IsString()
  age_group?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  min_gender_probability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  min_country_probability?: number;

  @IsOptional()
  @IsIn(['created_at', 'name', 'age'])
  sort_by?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: string = 'asc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AppEnvDto {
  @IsString()
  GITHUB_CLIENT_ID!: string;

  @IsString()
  GITHUB_CLIENT_SECRET!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  BACKEND_URL!: string;

  @IsString()
  WEB_PORTAL_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  CLI_CALLBACK_PORT!: number;

  @IsString()
  NODE_ENV!: string;
}

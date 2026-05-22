import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpsertTenantSettingsDto {
  @ApiPropertyOptional({ example: 'https://cdn.deltra.id/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  bgImageUrl?: string;

  @ApiPropertyOptional({ example: '#1A73E8' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a valid hex color' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#FBBC04' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor must be a valid hex color' })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 1, Jakarta' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+6221123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@sma-pelita.sch.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '20100001', description: 'Nomor Pokok Sekolah Nasional' })
  @IsOptional()
  @IsString()
  npsn?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  accreditation?: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'id' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: '2025/2026' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  semester?: number;
}

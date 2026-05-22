import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { TenantType } from '@prisma/client';

export class RegisterTenantDto {
  @ApiProperty({ example: 'SMA Pelita Bangsa' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({ example: 'sma-pelita', description: 'Subdomain slug (lowercase, hyphens only)' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug: string;

  @ApiProperty({ enum: TenantType })
  @IsEnum(TenantType)
  type: TenantType;

  @ApiProperty({ example: 'Budi Santoso', description: 'Admin full name' })
  @IsString()
  @IsNotEmpty()
  adminName: string;

  @ApiProperty({ example: 'budi@sma-pelita.sch.id' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsString()
  adminPhone?: string;
}

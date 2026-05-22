import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { TenantPlan, TenantType } from '@prisma/client';

export class CreateTenantDto {
  @ApiProperty({ example: 'SMA Pelita Bangsa' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'sma-pelita', description: 'Subdomain slug (lowercase, hyphens only)' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug: string;

  @ApiProperty({ enum: TenantType })
  @IsEnum(TenantType)
  type: TenantType;

  @ApiPropertyOptional({ enum: TenantPlan, default: TenantPlan.starter })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiPropertyOptional({ description: 'Parent tenant ID (for school networks)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

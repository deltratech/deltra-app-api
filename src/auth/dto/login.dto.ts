import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'budi@sma-pelita.sch.id or budi.santoso' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: 'sma-pelita', description: 'Tenant slug — omit for superadmin login' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

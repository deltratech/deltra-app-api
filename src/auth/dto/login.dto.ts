import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'budi@sma-pelita.sch.id or budi.santoso' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'sma-pelita', description: 'Tenant slug (subdomain)' })
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}

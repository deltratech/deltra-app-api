import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ValidateTenantSlugDto {
  @ApiProperty({ example: 'sma-pelita', description: 'Subdomain slug (lowercase, hyphens only)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ImpersonateDto {
  @ApiProperty({ description: 'Target school slug (must be a child of the caller\'s network)' })
  @IsString() @IsNotEmpty()
  tenantSlug: string;

  @ApiProperty({ description: 'Target user id inside that school' })
  @IsUUID()
  userId: string;
}

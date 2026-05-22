import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token received from login or previous refresh' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

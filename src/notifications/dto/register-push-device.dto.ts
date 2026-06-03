import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum PushDevicePlatformDto {
  web = 'web',
}

export class RegisterPushDeviceDto {
  @ApiProperty({ description: 'FCM registration token from the browser' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ enum: PushDevicePlatformDto, default: PushDevicePlatformDto.web })
  @IsOptional()
  @IsEnum(PushDevicePlatformDto)
  platform?: PushDevicePlatformDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

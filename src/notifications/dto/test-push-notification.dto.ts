import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class TestPushNotificationDto {
  @ApiProperty({ example: 'Test notification' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'This is a test push notification.' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}

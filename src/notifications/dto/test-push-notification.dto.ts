import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationCategory, NotificationPriority, NotificationSourceType } from '../../common/enums/notification.enum';

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

  @ApiPropertyOptional({ enum: NotificationCategory })
  @IsOptional()
  @IsEnum(NotificationCategory)
  category?: NotificationCategory;

  @ApiPropertyOptional({ example: 'test_notification' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ enum: NotificationSourceType })
  @IsOptional()
  @IsEnum(NotificationSourceType)
  sourceType?: NotificationSourceType;

  @ApiPropertyOptional({ description: 'UUID source id for deduping event notifications' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

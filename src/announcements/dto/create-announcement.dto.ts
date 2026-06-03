import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementAudienceType, AnnouncementChannel } from '../../common/enums/announcement.enum';

export class AnnouncementAttachmentDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  fileUrl: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sizeBytes?: number;
}

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ enum: AnnouncementAudienceType })
  @IsEnum(AnnouncementAudienceType)
  audienceType: AnnouncementAudienceType;

  @ApiPropertyOptional({ description: 'Required for grade-wide announcements' })
  @IsOptional()
  @IsInt()
  targetGradeLevel?: number;

  @ApiPropertyOptional({ description: 'Required for class-wide announcements' })
  @IsOptional()
  @IsUUID()
  targetClassroomId?: string;

  @ApiProperty({ enum: AnnouncementChannel, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AnnouncementChannel, { each: true })
  channels: AnnouncementChannel[];

  @ApiPropertyOptional({ description: 'Future ISO datetime. Omit to send manually or immediately via send endpoint.' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ type: [AnnouncementAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementAttachmentDto)
  attachments?: AnnouncementAttachmentDto[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AnnouncementTemplateCategory } from '../../common/enums/announcement.enum';

export class CreateAnnouncementTemplateDto {
  @ApiProperty({ enum: AnnouncementTemplateCategory })
  @IsEnum(AnnouncementTemplateCategory)
  category: AnnouncementTemplateCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;
}

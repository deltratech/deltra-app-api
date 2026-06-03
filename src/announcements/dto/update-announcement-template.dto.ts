import { PartialType } from '@nestjs/swagger';
import { CreateAnnouncementTemplateDto } from './create-announcement-template.dto';

export class UpdateAnnouncementTemplateDto extends PartialType(CreateAnnouncementTemplateDto) {}

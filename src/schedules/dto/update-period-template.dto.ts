import { PartialType } from '@nestjs/swagger';
import { CreatePeriodTemplateDto } from './create-period-template.dto';

export class UpdatePeriodTemplateDto extends PartialType(CreatePeriodTemplateDto) {}

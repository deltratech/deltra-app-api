import { PartialType } from '@nestjs/swagger';
import { CreateScheduleEntryDto } from './create-schedule-entry.dto';

export class UpdateScheduleEntryDto extends PartialType(CreateScheduleEntryDto) {}

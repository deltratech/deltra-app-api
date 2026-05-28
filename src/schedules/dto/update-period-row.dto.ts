import { PartialType } from '@nestjs/swagger';
import { CreatePeriodRowDto } from './create-period-row.dto';

export class UpdatePeriodRowDto extends PartialType(CreatePeriodRowDto) {}

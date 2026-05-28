import { PartialType } from '@nestjs/swagger';
import { CreateHomeroomAssignmentDto } from './create-homeroom-assignment.dto';

export class UpdateHomeroomAssignmentDto extends PartialType(CreateHomeroomAssignmentDto) {}

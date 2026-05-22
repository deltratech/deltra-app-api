import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateStudentProfileDto } from './create-student-profile.dto';

export class UpdateStudentProfileDto extends PartialType(
  OmitType(CreateStudentProfileDto, ['userId'] as const),
) {}

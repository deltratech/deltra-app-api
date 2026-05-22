import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTeacherProfileDto } from './create-teacher-profile.dto';

export class UpdateTeacherProfileDto extends PartialType(
  OmitType(CreateTeacherProfileDto, ['userId'] as const),
) {}

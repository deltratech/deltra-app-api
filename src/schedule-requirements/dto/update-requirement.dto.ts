import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRequirementDto } from './create-requirement.dto';

export class UpdateRequirementDto extends PartialType(
  OmitType(CreateRequirementDto, ['classroomId', 'subjectId', 'academicYear', 'semester'] as const),
) {}

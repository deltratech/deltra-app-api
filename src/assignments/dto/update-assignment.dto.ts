import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAssignmentDto } from './create-assignment.dto';

/** Classroom, subject, academic year, and type are immutable after creation. */
export class UpdateAssignmentDto extends PartialType(
  OmitType(CreateAssignmentDto, ['classroomId', 'subjectId', 'academicYearId', 'type'] as const),
) {}

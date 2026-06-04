import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAcademicNoteDto } from './create-academic-note.dto';

export class UpdateAcademicNoteDto extends PartialType(
  OmitType(CreateAcademicNoteDto, ['studentProfileIds'] as const),
) {}

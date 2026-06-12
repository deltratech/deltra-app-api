import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class FindStudentAssignmentsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by subject' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filter by academic year (term)' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

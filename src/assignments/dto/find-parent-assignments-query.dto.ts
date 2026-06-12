import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class FindParentAssignmentsQueryDto {
  @ApiPropertyOptional({ description: 'Limit to one linked student' })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;

  @ApiPropertyOptional({ description: 'Filter by academic year (term)' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Filter by subject' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class FindGradebookQueryDto {
  @ApiProperty({ description: 'Classroom to build the gradebook for' })
  @IsUUID()
  classroomId!: string;

  @ApiProperty({ description: 'Subject to build the gradebook for' })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ description: 'Limit to one academic year (term)' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}

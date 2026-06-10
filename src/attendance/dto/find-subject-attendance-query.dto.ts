import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class FindSubjectAttendanceQueryDto {
  @ApiPropertyOptional({ description: 'Schedule entry ID' })
  @IsOptional()
  @IsUUID()
  scheduleEntryId?: string;

  @ApiPropertyOptional({ description: 'Subject ID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Classroom ID' })
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiPropertyOptional({ description: 'Academic year ID' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ example: '2026-06-08', description: 'Daily attendance date. Defaults to today.' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-06-08', description: 'Week start date for weekly summary. Defaults to Monday of date.' })
  @IsOptional()
  @IsDateString()
  weekStart?: string;
}

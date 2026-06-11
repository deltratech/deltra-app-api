import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHomeroomAssignmentDto {
  @ApiProperty({ description: 'Classroom ID' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({ description: 'Teacher profile ID' })
  @IsUUID()
  teacherProfileId: string;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

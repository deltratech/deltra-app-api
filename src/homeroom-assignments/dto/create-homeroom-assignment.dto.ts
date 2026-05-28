import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateHomeroomAssignmentDto {
  @ApiProperty({ description: 'Classroom ID' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({ description: 'Teacher profile ID' })
  @IsUUID()
  teacherProfileId: string;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

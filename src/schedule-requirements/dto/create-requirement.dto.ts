import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateRequirementDto {
  @ApiProperty()
  @IsUUID()
  classroomId: string;

  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @ApiPropertyOptional({ description: 'Preferred room (optional)' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty({ example: 4, description: 'Sessions per week' })
  @IsInt()
  @Min(1)
  @Max(14)
  sessionsPerWeek: number;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(2)
  semester: number;
}

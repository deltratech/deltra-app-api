import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateScheduleDto {
  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(2)
  semester: number;

  @ApiPropertyOptional({
    description: 'Classroom IDs to schedule. If empty, all classrooms with requirements are scheduled.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  classroomIds?: string[];

  @ApiPropertyOptional({
    description: 'Max consecutive sessions for the same subject in a class. Default: 2',
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  maxConsecutive?: number;

  @ApiPropertyOptional({
    description: 'Clear existing DRAFT schedules for matched classrooms before generating. Default: true',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  clearDrafts?: boolean;
}

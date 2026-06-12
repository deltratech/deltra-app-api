import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum AssignmentTypeDto {
  file_upload = 'file_upload',
  online_exam = 'online_exam',
}

export enum AssignmentStatusDto {
  draft = 'draft',
  published = 'published',
  closed = 'closed',
}

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Classroom the assignment is issued to' })
  @IsUUID()
  classroomId!: string;

  @ApiProperty({ description: 'Subject the assignment belongs to' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ description: 'Academic year (term)' })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({ example: 'Tugas — Aplikasi Integral Tertentu' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-06-18T16:59:00.000Z', description: 'Submission deadline' })
  @IsDateString()
  dueAt!: string;

  @ApiPropertyOptional({ default: 100, description: 'Maximum obtainable score' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(999.99)
  maxScore?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @ApiPropertyOptional({
    enum: AssignmentTypeDto,
    default: AssignmentTypeDto.file_upload,
    description: 'online_exam is reserved and rejected until the exam platform ships',
  })
  @IsOptional()
  @IsEnum(AssignmentTypeDto)
  type?: AssignmentTypeDto;
}

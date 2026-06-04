import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function toBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class CreateAcademicNoteDto {
  @ApiProperty({ type: [String], description: 'One or more student profile IDs' })
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  studentProfileIds: string[];

  @ApiProperty({ example: 'Progress Matematika Mingguan' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Siswa menunjukkan peningkatan dalam aljabar dasar.' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ description: 'Related subject ID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Related classroom ID' })
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiPropertyOptional({ example: '2026-06-04' })
  @IsOptional()
  @IsDateString()
  noteDate?: string;

  @ApiPropertyOptional({ default: true })
  @Transform(({ value }) => toBoolean(value))
  @IsOptional()
  @IsBoolean()
  visibleToGuardian?: boolean;
}

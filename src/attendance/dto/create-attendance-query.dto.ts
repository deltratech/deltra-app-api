import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum AttendanceStatusDto {
  present = 'present',
  late = 'late',
  excused = 'excused',
  sick = 'sick',
  absent = 'absent',
}

export class CreateAttendanceRecordDto {
  @ApiProperty({ description: 'Student profile ID' })
  @IsUUID()
  studentProfileId!: string;

  @ApiProperty({ enum: AttendanceStatusDto })
  @IsEnum(AttendanceStatusDto)
  status!: AttendanceStatusDto;

  @ApiPropertyOptional({ description: 'Minutes late, usually set when status is late' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lateMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Classroom ID for the attendance records' })
  @IsUUID()
  classroomId!: string;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId!: string;

  @ApiPropertyOptional({ description: 'Schedule entry ID. Required when a subject teacher marks subject attendance.' })
  @IsOptional()
  @IsUUID()
  scheduleEntryId?: string;

  @ApiProperty({ example: '2026-06-08' })
  @IsDateString()
  attendanceDate!: string;

  @ApiPropertyOptional({ description: 'Reason written when this request updates existing records' })
  @IsOptional()
  @IsString()
  updateReason?: string;

  @ApiProperty({ type: [CreateAttendanceRecordDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateAttendanceRecordDto)
  records!: CreateAttendanceRecordDto[];
}

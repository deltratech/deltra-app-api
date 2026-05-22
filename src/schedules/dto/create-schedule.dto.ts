import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';

export class CreateScheduleDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty()
  @IsUUID()
  timeSlotId: string;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 1, description: '1 or 2' })
  @IsInt()
  @Min(1)
  @Max(2)
  semester: number;

  @ApiPropertyOptional({ enum: ScheduleStatus, default: ScheduleStatus.draft })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

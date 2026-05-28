import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Classroom / class section ID' })
  @IsUUID()
  classroomId: string;

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

  @ApiPropertyOptional({ description: 'Source schedule ID when copying a semester/timetable' })
  @IsOptional()
  @IsUUID()
  copiedFromScheduleId?: string;
}

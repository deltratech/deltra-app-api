import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Classroom / class section ID' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId: string;

  @ApiPropertyOptional({ enum: ScheduleStatus, default: ScheduleStatus.draft })
  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @ApiPropertyOptional({ description: 'Source schedule ID when copying a semester/timetable' })
  @IsOptional()
  @IsUUID()
  copiedFromScheduleId?: string;
}

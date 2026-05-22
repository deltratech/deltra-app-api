import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DayOfWeek } from '../../common/enums/day-of-week.enum';

export class CreateUnavailabilityDto {
  @ApiProperty()
  @IsUUID()
  teacherProfileId: string;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ description: 'Time slot ID that teacher cannot teach' })
  @IsUUID()
  timeSlotId: string;

  @ApiPropertyOptional({ example: 'Personal appointment' })
  @IsOptional()
  @IsString()
  reason?: string;
}

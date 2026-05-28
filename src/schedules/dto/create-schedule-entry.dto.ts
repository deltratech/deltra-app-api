import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateScheduleEntryDto {
  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiProperty()
  @IsUUID()
  teacherProfileId: string;

  @ApiProperty()
  @IsUUID()
  roomId: string;

  @ApiPropertyOptional({ description: 'ISO weekday, 1 = Monday. Omit with periodRowId to park in tray.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Period row ID. Omit with dayOfWeek to park in tray.' })
  @IsOptional()
  @IsUUID()
  periodRowId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

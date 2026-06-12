import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

export enum AttendanceAggregatePeriod {
  daily = 'daily',
  weekly = 'weekly',
  monthly = 'monthly',
  termly = 'termly',
}

export class FindParentAttendanceQueryDto {
  @ApiPropertyOptional({ description: 'Limit to one linked student profile ID' })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;

  @ApiPropertyOptional({ description: 'Filter by subject ID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Academic year ID. Required only when selecting a specific term.' })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ enum: AttendanceAggregatePeriod, default: AttendanceAggregatePeriod.daily })
  @IsOptional()
  @IsEnum(AttendanceAggregatePeriod)
  period?: AttendanceAggregatePeriod;

  @ApiPropertyOptional({ example: '2026-06-08', description: 'Anchor date for daily, weekly, monthly, or termly lookup.' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-06', description: 'Month for monthly aggregation. Overrides date month.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

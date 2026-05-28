import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateUnavailabilityDto {
  @ApiProperty()
  @IsUUID()
  teacherProfileId: string;

  @ApiProperty({ example: 1, description: 'ISO weekday, 1 = Monday, 5 = Friday' })
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek: number;

  @ApiProperty({ description: 'Period row ID that teacher cannot teach' })
  @IsUUID()
  periodRowId: string;

  @ApiPropertyOptional({ example: 'Personal appointment' })
  @IsOptional()
  @IsString()
  reason?: string;
}

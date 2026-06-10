import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CreatePeriodTemplateDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  gradeLevel: number;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId: string;

  @ApiProperty({ example: '07:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  dayStart: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMySubmissionDto {
  @ApiPropertyOptional({ description: 'Optional note from the student to the teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

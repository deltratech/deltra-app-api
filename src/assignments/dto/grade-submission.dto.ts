import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GradeSubmissionDto {
  @ApiProperty({ example: 87.5, description: 'Score between 0 and the assignment maxScore' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ description: 'Feedback shown to the student and parents' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

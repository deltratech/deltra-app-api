import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export enum PeriodKindDto {
  lesson = 'lesson',
  recess = 'recess',
  break = 'break',
}

export class CreatePeriodRowDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  sortOrder: number;

  @ApiProperty({ enum: PeriodKindDto })
  @IsEnum(PeriodKindDto)
  kind: PeriodKindDto;

  @ApiProperty({ example: 'Period 1' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(1)
  durationMin: number;

  @ApiPropertyOptional({ type: [Number], example: [1, 2, 3, 4, 5], default: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  activeDays?: number[];
}

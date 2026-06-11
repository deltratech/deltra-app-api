import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AssignTestDto {
  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  testDate: string;
}

export class RecordResultDto {
  @ApiProperty({ description: 'true = passed, false = failed' })
  @IsBoolean()
  passed: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  testScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  resultNotes?: string;
}

export class DecisionDto {
  @ApiProperty({ description: 'true = accepted, false = rejected' })
  @IsBoolean()
  accepted: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  resultNotes?: string;
}

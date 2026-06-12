import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Unified stage transition — moves an application to any stage; the stage's role
 *  drives side-effects (test date, enrollment, etc.). */
export class SetStageDto {
  @ApiProperty({ example: 'test', description: 'Target stage key (AdmissionStageDef.key)' })
  @IsString()
  stageKey: string;

  @ApiPropertyOptional({ example: '2026-06-20', description: 'Test date (used when the target stage has the `test` role)' })
  @IsOptional() @IsDateString()
  testDate?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  testScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  resultNotes?: string;
}

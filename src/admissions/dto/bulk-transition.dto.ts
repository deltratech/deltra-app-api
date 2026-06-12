import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdmissionSchoolLevel } from '../admissions.enums';

export type BulkAction = 'set_stage' | 'block' | 'unblock';

class BulkFilterDto {
  @ApiPropertyOptional({ description: 'Filter by stage key' })
  @IsOptional() @IsString()
  stageKey?: string;

  @ApiPropertyOptional({ enum: AdmissionSchoolLevel })
  @IsOptional() @IsEnum(AdmissionSchoolLevel)
  schoolLevel?: AdmissionSchoolLevel;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  academicYear?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;
}

export class BulkTransitionDto {
  @ApiProperty({ enum: ['set_stage', 'block', 'unblock'] })
  @IsEnum({ set_stage: 'set_stage', block: 'block', unblock: 'unblock' })
  action: BulkAction;

  @ApiPropertyOptional({ type: [String], description: 'Explicit applicant ids' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Operate on all applications matching this filter' })
  @IsOptional() @ValidateNested() @Type(() => BulkFilterDto)
  filter?: BulkFilterDto;

  // ── action payloads ──
  @ApiPropertyOptional({ description: 'Target stage key for set_stage' })
  @IsOptional() @IsString()
  stageKey?: string;

  @ApiPropertyOptional({ description: 'Test date when the target stage has the `test` role' })
  @IsOptional() @IsDateString()
  testDate?: string;

  @ApiPropertyOptional({ description: 'Reason for block' })
  @IsOptional() @IsString()
  reason?: string;
}

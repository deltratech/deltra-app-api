import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdmissionSchoolLevel, AdmissionStage } from '../admissions.enums';

export type BulkAction = 'assign_test' | 'record_result' | 'decision' | 'send_offer' | 'enroll' | 'set_stage' | 'block' | 'unblock';

class BulkFilterDto {
  @ApiPropertyOptional({ enum: AdmissionStage })
  @IsOptional() @IsEnum(AdmissionStage)
  stage?: AdmissionStage;

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
  @ApiProperty({ enum: ['assign_test', 'record_result', 'decision', 'send_offer', 'enroll'] })
  @IsEnum({ assign_test: 'assign_test', record_result: 'record_result', decision: 'decision', send_offer: 'send_offer', enroll: 'enroll', set_stage: 'set_stage', block: 'block', unblock: 'unblock' })
  action: BulkAction;

  @ApiPropertyOptional({ type: [String], description: 'Explicit applicant ids' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Operate on all applications matching this filter' })
  @IsOptional() @ValidateNested() @Type(() => BulkFilterDto)
  filter?: BulkFilterDto;

  // ── action payloads ──
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  testDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  passed?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  testScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  accepted?: boolean;

  @ApiPropertyOptional({ enum: AdmissionStage, description: 'Target stage for set_stage' })
  @IsOptional() @IsEnum(AdmissionStage)
  stage?: AdmissionStage;

  @ApiPropertyOptional({ description: 'Reason for block' })
  @IsOptional() @IsString()
  reason?: string;
}

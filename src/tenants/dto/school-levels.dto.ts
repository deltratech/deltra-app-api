import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** Education levels a school can offer (mirrors the tenant-schema AdmissionSchoolLevel). */
export enum SchoolLevel {
  preschool = 'preschool',
  primary = 'primary',
  secondary = 'secondary',
}

/**
 * Mixin-style fields shared by create + register DTOs: which levels a school
 * offers, and (for preschool) its custom sub-types e.g. "Kiddy 1", "Kiddy 2".
 */
export class SchoolLevelsDto {
  @ApiPropertyOptional({ enum: SchoolLevel, isArray: true, description: 'Education levels this school offers' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(SchoolLevel, { each: true })
  levelsOffered?: SchoolLevel[];

  @ApiPropertyOptional({ type: [String], description: 'Custom preschool sub-types, e.g. ["Kiddy 1", "Kiddy 2"]' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  preschoolTypes?: string[];
}

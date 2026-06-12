import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';
import { AdmissionSchoolLevel } from '../admissions.enums';
import type { PpdbField, PpdbRequiredDoc } from '../ppdb-form.defaults';

export class CreatePpdbFormDto {
  @ApiProperty({ example: '2026-2027' })
  @IsString() @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  title?: string;
}

export class UpdatePpdbFormDto {
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Custom short link slug (a-z, 0-9, hyphen); null to clear' })
  @IsOptional() @IsString()
  slug?: string | null;

  @ApiPropertyOptional({ description: 'Form header intro text shown to parents' })
  @IsOptional() @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Applicant-info field definitions' })
  @IsOptional() @IsArray()
  fields?: PpdbField[];

  @ApiPropertyOptional({ description: 'Required-document checklist' })
  @IsOptional() @IsArray()
  requiredDocuments?: PpdbRequiredDoc[];

  @ApiPropertyOptional({ description: 'Manual/bank-transfer payment instructions shown to parents' })
  @IsOptional() @IsString()
  paymentInstructions?: string | null;

  @ApiPropertyOptional({ description: 'Acceptance-letter body template (placeholders like {applicantName})' })
  @IsOptional() @IsString()
  acceptanceLetter?: string | null;
}

/** Public (no-auth) applicant submission via the shared PPDB link. */
export class PublicSubmitDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  applicantName: string;

  @ApiProperty({ enum: AdmissionSchoolLevel })
  @IsEnum(AdmissionSchoolLevel)
  schoolLevel: AdmissionSchoolLevel;

  @ApiProperty({ example: 'Grade 7' })
  @IsString() @IsNotEmpty()
  gradeLabel: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  applicantNik?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  guardianName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ description: 'Answers to custom (non-system) form fields' })
  @IsOptional() @IsObject()
  formData?: Record<string, unknown>;
}

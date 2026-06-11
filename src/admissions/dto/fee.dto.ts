import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import {
  AdmissionFeeType, AdmissionPaymentTerm, AdmissionSchoolLevel, AdmissionStudentCategory,
} from '../admissions.enums';

export class CreateFeeScheduleDto {
  @ApiProperty({ enum: AdmissionSchoolLevel })
  @IsEnum(AdmissionSchoolLevel)
  schoolLevel: AdmissionSchoolLevel;

  @ApiPropertyOptional({ description: 'null/omit = applies to all grades in level' })
  @IsOptional() @IsString()
  gradeLabel?: string;

  @ApiPropertyOptional({ enum: AdmissionStudentCategory })
  @IsOptional() @IsEnum(AdmissionStudentCategory)
  studentCategory?: AdmissionStudentCategory;

  @ApiProperty({ enum: AdmissionFeeType })
  @IsEnum(AdmissionFeeType)
  feeType: AdmissionFeeType;

  @ApiProperty({ example: '2026-2027' })
  @IsString() @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: 5000000, description: 'IDR integer' })
  @IsInt() @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: AdmissionPaymentTerm })
  @IsOptional() @IsEnum(AdmissionPaymentTerm)
  paymentTerm?: AdmissionPaymentTerm;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeeScheduleDto extends PartialType(CreateFeeScheduleDto) {}

export class CreateDevFeeTierDto {
  @ApiProperty({ enum: AdmissionSchoolLevel })
  @IsEnum(AdmissionSchoolLevel)
  schoolLevel: AdmissionSchoolLevel;

  @ApiPropertyOptional({ enum: AdmissionStudentCategory })
  @IsOptional() @IsEnum(AdmissionStudentCategory)
  studentCategory?: AdmissionStudentCategory;

  @ApiProperty({ example: 'Gr 7-12 (6 yrs)' })
  @IsString() @IsNotEmpty()
  durationLabel: string;

  @ApiProperty({ example: 'Grade 7' })
  @IsString() @IsNotEmpty()
  gradeFromLabel: string;

  @ApiPropertyOptional({ example: 'Grade 12' })
  @IsOptional() @IsString()
  gradeToLabel?: string;

  @ApiProperty({ example: 75000000, description: 'IDR integer' })
  @IsInt() @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: AdmissionPaymentTerm })
  @IsOptional() @IsEnum(AdmissionPaymentTerm)
  paymentTerm?: AdmissionPaymentTerm;

  @ApiProperty({ example: '2026-2027' })
  @IsString() @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateDevFeeTierDto extends PartialType(CreateDevFeeTierDto) {}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';
import {
  AdmissionSchoolLevel, AdmissionStudentCategory, AdmissionStage,
} from '../admissions.enums';

export class CreateApplicationDto {
  @ApiProperty({ example: 'Rizky Aditya Putra' })
  @IsString() @IsNotEmpty()
  applicantName: string;

  @ApiPropertyOptional({ example: '3201010101100001' })
  @IsOptional() @IsString()
  applicantNik?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional() @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 'Bpk. Aditya' })
  @IsOptional() @IsString()
  guardianName?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional() @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({ example: 'parent@example.com' })
  @IsOptional() @IsEmail()
  guardianEmail?: string;

  @ApiProperty({ enum: AdmissionSchoolLevel })
  @IsEnum(AdmissionSchoolLevel)
  schoolLevel: AdmissionSchoolLevel;

  @ApiProperty({ example: 'Grade 7' })
  @IsString() @IsNotEmpty()
  gradeLabel: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString() @IsNotEmpty()
  academicYear: string;

  @ApiPropertyOptional({ enum: AdmissionStudentCategory })
  @IsOptional() @IsEnum(AdmissionStudentCategory)
  studentCategory?: AdmissionStudentCategory;

  @ApiPropertyOptional({ enum: AdmissionStage })
  @IsOptional() @IsEnum(AdmissionStage)
  stage?: AdmissionStage;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  testScore?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';

export enum TeacherContractTemplateType {
  guru_tetap = 'guru_tetap',
  guru_honorer = 'guru_honorer',
  staff = 'staff',
}

export enum TeacherContractStatus {
  draft = 'draft',
  pending_signature = 'pending_signature',
  active = 'active',
  expired = 'expired',
  renewed = 'renewed',
}

export class CreateTeacherContractDto {
  @ApiProperty({ description: 'Teacher profile ID linked to the uploaded contract' })
  @IsUUID()
  teacherProfileId: string;

  @ApiPropertyOptional({ enum: TeacherContractTemplateType, description: 'If omitted, inferred from employment status' })
  @IsOptional()
  @IsEnum(TeacherContractTemplateType)
  templateType?: TeacherContractTemplateType;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  contractStartDate: string;

  @ApiProperty({ example: '2027-06-30' })
  @IsDateString()
  contractEndDate: string;

  @ApiPropertyOptional({ example: 'Guru Matematika' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleTitle?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus, description: 'Override employment status used for template inference and wording' })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ example: 24, description: 'Teaching hours per week. Auto-calculated if omitted where possible.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  teachingHoursPerWeek?: number;

  @ApiPropertyOptional({ example: 'Mengajar 4 kelas dan membina olimpiade matematika' })
  @IsOptional()
  @IsString()
  teachingAssignmentNotes?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @ApiPropertyOptional({ description: 'Base64 text of e-signature image/string' })
  @IsOptional()
  @IsString()
  eSignature?: string;

  @ApiPropertyOptional({ example: 'Kontrak Kerja Guru Matematika 2026-2027.pdf' })
  @IsOptional()
  @IsString()
  documentTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

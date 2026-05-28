import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';
import { TeacherContractTemplateType } from './create-teacher-contract.dto';

export class CreateUploadedTeacherContractDto {
  @ApiProperty({ description: 'Teacher profile ID linked to uploaded contract' })
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

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ example: 'Kontrak Kerja Guru 2026-2027.pdf' })
  @IsOptional()
  @IsString()
  documentTitle?: string;

  @ApiPropertyOptional({ description: 'Base64 text of e-signature image/string' })
  @IsOptional()
  @IsString()
  eSignature?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2027-05-30T09:00:00.000Z', description: 'Custom reminder datetime. If omitted, defaults to contractEndDate - 30 days.' })
  @IsOptional()
  @IsDateString()
  renewalReminderAt?: string;
}

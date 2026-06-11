import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';
import { DocumentCategory } from '../document-categories';

export class CreateUploadedTeacherContractDto {
  @ApiPropertyOptional({ description: 'Teacher profile ID for teacher recipients' })
  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @ApiPropertyOptional({ description: 'User ID for principal/staff recipients' })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @ApiPropertyOptional({ enum: DocumentCategory, description: 'Contracts & SK document type' })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ description: 'Recipient type override (teacher/staff/principal)' })
  @IsOptional()
  @IsString()
  recipientType?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  contractStartDate: string;

  @ApiPropertyOptional({ example: '2027-06-30', description: 'Optional for open-ended SK / position assignments' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

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

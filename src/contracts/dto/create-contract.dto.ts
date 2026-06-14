import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';
import { DocumentCategory } from '../document-categories';

export enum ContractStatus {
  draft = 'draft',
  pending_signature = 'pending_signature',
  pending_approval = 'pending_approval',
  approved = 'approved',
  rejected = 'rejected',
  active = 'active',
  archived = 'archived',
  expired = 'expired',
  renewed = 'renewed',
}

export class CreateContractDto {
  @ApiPropertyOptional({ description: 'Teacher profile ID for teacher recipients' })
  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @ApiPropertyOptional({ description: 'User ID for principal/staff recipients' })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @ApiPropertyOptional({ enum: DocumentCategory, description: 'Official document category (drives approver/signer/side-effect)' })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ description: 'Recipient type override (teacher/staff/principal). Defaults from template/category.' })
  @IsOptional()
  @IsString()
  recipientType?: string;

  @ApiPropertyOptional({ description: 'Approver roles for this document, e.g. ["principal","network_admin"]', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverRoles?: string[];

  @ApiPropertyOptional({ description: 'Category-specific structured data (e.g. teaching assignment items) stored as JSON' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Template ID to use for DOCX generation' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  contractStartDate: string;

  @ApiPropertyOptional({ example: '2027-06-30', description: 'Optional for open-ended SK / position assignments' })
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional({
    enum: ContractStatus,
    description: 'Initial contract status. Defaults to draft when omitted.',
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

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

  @ApiPropertyOptional({ example: '2027-05-30T09:00:00.000Z', description: 'Custom reminder datetime. If omitted, defaults to contractEndDate - 30 days.' })
  @IsOptional()
  @IsDateString()
  renewalReminderAt?: string;

  @ApiPropertyOptional({ description: 'Custom variable key-value map required by template' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string | number>;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';
import { DocumentCategory } from '../document-categories';

export class PreviewTeacherContractDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiProperty()
  @IsDateString()
  contractStartDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, string | number>;
}

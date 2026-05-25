import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';
import { TeacherContractTemplateType } from './create-teacher-contract.dto';

export class PreviewTeacherContractDto {
  @ApiProperty()
  @IsUUID()
  teacherProfileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ enum: TeacherContractTemplateType })
  @IsOptional()
  @IsEnum(TeacherContractTemplateType)
  templateType?: TeacherContractTemplateType;

  @ApiProperty()
  @IsDateString()
  contractStartDate: string;

  @ApiProperty()
  @IsDateString()
  contractEndDate: string;

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

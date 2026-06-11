import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';

export class PreviewTeacherContractDto {
  @ApiProperty()
  @IsUUID()
  teacherProfileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;

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

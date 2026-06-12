import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AdmissionDocStatus, AdmissionDocType } from '../admissions.enums';

export class CreateDocumentDto {
  @ApiProperty({ enum: AdmissionDocType })
  @IsEnum(AdmissionDocType)
  documentType: AdmissionDocType;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  fileUrl: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  fileName: string;
}

export class VerifyDocumentDto {
  @ApiProperty({ enum: [AdmissionDocStatus.verified, AdmissionDocStatus.rejected] })
  @IsEnum(AdmissionDocStatus)
  status: AdmissionDocStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

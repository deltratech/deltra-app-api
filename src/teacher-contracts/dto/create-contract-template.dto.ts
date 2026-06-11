import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { DocumentCategory } from '../document-categories';

export class CreateContractTemplateDto {
  @ApiProperty({ example: 'Template SK Tugas Mengajar Standard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: DocumentCategory, description: 'Document category this template is for' })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({ description: 'JSON array mapping each signature slot to a signer: [{ "key": "eSignature", "role": "principal" }]' })
  @IsOptional()
  @IsString()
  signatureSlots?: string;

  @ApiPropertyOptional({ description: 'Who the document is addressed to', enum: ['teacher', 'principal', 'staff'] })
  @IsOptional()
  @IsString()
  recipientType?: string;

  @ApiPropertyOptional({ description: 'JSON array of approver roles, e.g. ["principal","network_admin"]' })
  @IsOptional()
  @IsString()
  approverRoles?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

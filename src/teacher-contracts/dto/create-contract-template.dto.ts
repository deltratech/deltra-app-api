import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { TeacherContractTemplateType } from './create-teacher-contract.dto';

export class CreateContractTemplateDto {
  @ApiProperty({ example: 'Template Guru Tetap Standard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TeacherContractTemplateType })
  @IsEnum(TeacherContractTemplateType)
  templateType: TeacherContractTemplateType;

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

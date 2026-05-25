import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { TeacherContractTemplateType } from './create-teacher-contract.dto';

export class CreateContractTemplateDto {
  @ApiProperty({ example: 'GURU_TETAP_STD' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Template Guru Tetap Standard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TeacherContractTemplateType })
  @IsEnum(TeacherContractTemplateType)
  templateType: TeacherContractTemplateType;

  @ApiPropertyOptional({ example: 'Kontrak {teacherName} sebagai {roleTitle}...' })
  @IsOptional()
  @IsString()
  body: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

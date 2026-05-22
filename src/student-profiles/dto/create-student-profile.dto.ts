import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';
import { StudentStatus } from '../../common/enums/student-status.enum';

export class CreateStudentProfileDto {
  @ApiProperty({ description: 'User ID this profile belongs to' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: '0123456789', description: 'Nomor Induk Siswa Nasional' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nisn?: string;

  @ApiPropertyOptional({ example: '3201010101080001', description: 'Nomor Induk Kependudukan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nik?: string;

  @ApiPropertyOptional({ example: '2008-05-14' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @IsString()
  birthPlace?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 'Islam' })
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsPhoneNumber('ID')
  phone?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  entryYear?: number;

  @ApiPropertyOptional({ enum: StudentStatus, default: StudentStatus.active })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

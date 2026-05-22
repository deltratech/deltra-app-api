import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
} from 'class-validator';
import { Gender } from '../../common/enums/gender.enum';
import { TeacherStatus } from '../../common/enums/teacher-status.enum';
import { EmploymentStatus } from '../../common/enums/employment-status.enum';

export class CreateTeacherProfileDto {
  @ApiProperty({ description: 'User ID this profile belongs to' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: '1234567890123456', description: 'Nomor Unik Pendidik dan Tenaga Kependidikan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nuptk?: string;

  @ApiPropertyOptional({ example: '3201010101800001', description: 'Nomor Induk Kependudukan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nik?: string;

  @ApiPropertyOptional({ example: '1985-04-21' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Bandung' })
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

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsPhoneNumber('ID')
  phone?: string;

  @ApiPropertyOptional({ example: 'guru@sma-pelita.sch.id' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus, description: 'pns | p3k | tetap | honorer' })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: TeacherStatus, default: TeacherStatus.active })
  @IsOptional()
  @IsEnum(TeacherStatus)
  status?: TeacherStatus;
}

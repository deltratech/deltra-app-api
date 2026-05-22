import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class CreateGuardianDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'father', description: 'e.g. father, mother, guardian, sibling' })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ example: '+6281234567890' })
  @IsOptional()
  @IsPhoneNumber('ID')
  phone?: string;

  @ApiPropertyOptional({ example: 'budi@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: false, description: 'Mark as primary contact' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

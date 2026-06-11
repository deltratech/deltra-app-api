import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSuperadminDto {
  @ApiProperty({ example: 'superadmin@deltra.id' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'superadmin' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'Super Admin' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'superadmin123' })
  @IsString()
  @MinLength(8)
  password: string;
}

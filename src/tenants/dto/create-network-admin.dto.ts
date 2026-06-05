import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateNetworkAdminDto {
  @ApiProperty({ example: 'admin@ciputra-kasih.id' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'ciputra.admin' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @ApiProperty({ example: 'Ciputra Admin' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ minLength: 8, example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  networkId!: string;
}

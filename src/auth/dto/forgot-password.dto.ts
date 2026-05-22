import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'budi@sma-pelita.sch.id' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'sma-pelita' })
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}

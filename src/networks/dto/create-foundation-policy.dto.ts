import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateFoundationPolicyDto {
  @ApiProperty({ example: 'Standard Teacher Contract Policy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'teacher_contract' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: { renewalReminderDays: 30 } })
  @IsObject()
  content: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

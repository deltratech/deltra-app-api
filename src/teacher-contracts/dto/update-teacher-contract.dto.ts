import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateTeacherContractDto } from './create-teacher-contract.dto';

export class UpdateTeacherContractDto extends PartialType(CreateTeacherContractDto) {
  @ApiPropertyOptional({ example: '2026-06-15T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}

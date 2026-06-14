import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateContractDto } from './create-contract.dto';

export class UpdateContractDto extends PartialType(CreateContractDto) {
  @ApiPropertyOptional({ example: '2026-06-15T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString,
  IsUUID, Min, ValidateNested,
} from 'class-validator';

export class InvoiceItemDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 5000000 })
  @IsInt() @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  periodLabel?: string;

  @ApiPropertyOptional({ description: 'Source fee schedule id' })
  @IsOptional() @IsUUID()
  feeScheduleId?: string;

  @ApiPropertyOptional({ description: 'Source dev-fee tier id' })
  @IsOptional() @IsUUID()
  devFeeTierId?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  notes?: string;
}

export class RecordPaymentDto {
  @ApiPropertyOptional({ description: 'Amount paid; omit to mark fully paid' })
  @IsOptional() @IsInt() @Min(0)
  amount?: number;
}

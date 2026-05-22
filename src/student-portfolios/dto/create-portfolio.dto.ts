import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { PortfolioType } from '../../common/enums/portfolio-type.enum';

export class CreatePortfolioDto {
  @ApiProperty()
  @IsUUID()
  studentProfileId: string;

  @ApiProperty({ example: 'Aplikasi Manajemen Perpustakaan' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: PortfolioType })
  @IsEnum(PortfolioType)
  type: PortfolioType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Related subject ID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ example: '2024-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-01' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

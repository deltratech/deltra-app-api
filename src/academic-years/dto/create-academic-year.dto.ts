import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026/2027', description: 'Academic year label' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}\/\d{4}$/, { message: 'label must be in the form YYYY/YYYY, e.g. 2026/2027' })
  label!: string;

  @ApiProperty({ example: 1, description: 'Semester (1 = ganjil, 2 = genap)' })
  @IsInt()
  @Min(1)
  @Max(2)
  semester!: number;

  @ApiProperty({ example: '2026-07-15', description: 'Term start date (ISO)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-20', description: 'Term end date (ISO)' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: false, description: 'Make this the active term on creation' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

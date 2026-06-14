import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateClassroomDto {
  @ApiProperty({ example: 'X IPA 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 10, description: '1–12 = numeric grades; ≤ 0 = preschool sub-type by index (0, -1, -2, …)' })
  @IsInt()
  @Min(-50)
  @Max(12)
  gradeLevel!: number;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId!: string;
}

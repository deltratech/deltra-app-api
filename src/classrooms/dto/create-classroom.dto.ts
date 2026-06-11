import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateClassroomDto {
  @ApiProperty({ example: 'X IPA 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;

  @ApiProperty({ description: 'Academic year ID' })
  @IsUUID()
  academicYearId!: string;
}

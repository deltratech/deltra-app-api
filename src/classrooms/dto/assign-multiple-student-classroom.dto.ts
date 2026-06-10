import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ArrayNotEmpty } from 'class-validator';

export class AssignMultipleStudentClassroomDto {
  @ApiProperty({ description: 'ID of the classroom to assign' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  studentProfileIds!: string[];
}

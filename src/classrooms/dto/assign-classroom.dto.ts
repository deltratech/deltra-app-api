import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
export class AssignClassroomDto {
  @ApiProperty({
    description: 'ID of the student profile to assign to the classroom',
  })
  @IsUUID()
  studentProfileId!: string;
}

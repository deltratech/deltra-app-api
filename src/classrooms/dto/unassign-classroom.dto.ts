import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
export class UnassignClassroomDto {
  @ApiProperty({
    description: 'ID of the student profile to unassign from the classroom',
  })
  @IsUUID()
  studentProfileId!: string;
  @ApiProperty({
    description: 'Status to set when unassigning a student',
    enum: ['transferred', 'graduated', 'dropped'],
  })
  @IsIn(['transferred', 'graduated', 'dropped'])
  status!: 'transferred' | 'graduated' | 'dropped';
}

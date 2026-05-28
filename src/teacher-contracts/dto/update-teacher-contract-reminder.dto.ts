import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class UpdateTeacherContractReminderDto {
  @ApiProperty({ example: '2027-05-30T09:00:00.000Z' })
  @IsDateString()
  renewalReminderAt: string;
}

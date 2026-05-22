import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString, Matches } from 'class-validator';

export class CreateTimeSlotDto {
  @ApiProperty({ example: 'Jam ke-1' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: '07:00', description: 'HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm' })
  startTime: string;

  @ApiProperty({ example: '07:45', description: 'HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm' })
  endTime: string;

  @ApiProperty({ example: 1, description: 'Display order (1 = first period)' })
  @IsInt()
  @IsPositive()
  sortOrder: number;
}

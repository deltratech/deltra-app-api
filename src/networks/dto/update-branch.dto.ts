import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateBranchDto {
  @ApiProperty({ example: 'SMA Pelita Bangsa' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

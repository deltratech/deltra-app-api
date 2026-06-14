import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { SchoolLevelsDto } from '../../tenants/dto/school-levels.dto';

export class UpdateBranchDto extends SchoolLevelsDto {
  @ApiProperty({ example: 'SMA Pelita Bangsa' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

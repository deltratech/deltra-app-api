import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum BranchStatus {
  active = 'active',
  inactive = 'inactive',
}

export class UpdateBranchStatusDto {
  @ApiProperty({ enum: BranchStatus })
  @IsEnum(BranchStatus)
  status!: BranchStatus;
}

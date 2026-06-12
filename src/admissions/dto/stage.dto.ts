import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum StageRoleDto {
  entry = 'entry',
  test = 'test',
  offer = 'offer',
  accepted = 'accepted',
  enrolled = 'enrolled',
  rejected = 'rejected',
  generic = 'generic',
}

export class CreateStageDto {
  @ApiProperty({ example: 'Interview' })
  @IsString() @MaxLength(60)
  label: string;

  @ApiPropertyOptional({ enum: StageRoleDto })
  @IsOptional() @IsEnum(StageRoleDto)
  role?: StageRoleDto;

  @ApiPropertyOptional({ description: 'Dot color (tailwind class or hex)' })
  @IsOptional() @IsString() @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ description: 'Parent-facing label' })
  @IsOptional() @IsString() @MaxLength(80)
  publicLabel?: string;
}

export class UpdateStageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({ enum: StageRoleDto })
  @IsOptional() @IsEnum(StageRoleDto)
  role?: StageRoleDto;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  color?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  publicLabel?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ReorderStagesDto {
  @ApiProperty({ type: [String], description: 'Stage ids in the desired order' })
  @IsArray() @IsUUID('all', { each: true })
  ids: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class UserRoleItem {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateRolesDto {
  @ApiProperty({ type: [UserRoleItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserRoleItem)
  users: UserRoleItem[];
}

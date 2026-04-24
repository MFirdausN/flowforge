import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UserRoleEnum } from '../../../common/enums/user-role.enum';

export class UpdateUserRoleDto {
  @IsEnum(UserRoleEnum)
  role: UserRoleEnum;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @IsMongoId()
  @IsNotEmpty()
  roleId: string;
}

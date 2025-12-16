import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  permissionIds: string[];
}

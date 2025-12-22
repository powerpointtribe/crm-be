import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'New role ID to assign to the user' })
  @IsNotEmpty()
  @IsMongoId()
  roleId: string;
}

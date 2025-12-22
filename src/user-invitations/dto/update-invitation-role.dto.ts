import { IsNotEmpty, IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInvitationRoleDto {
  @ApiProperty({ description: 'New role ID to assign to the member' })
  @IsNotEmpty()
  @IsMongoId()
  roleId: string;

  @ApiPropertyOptional({ description: 'Additional notes about this update' })
  @IsOptional()
  @IsString()
  notes?: string;
}

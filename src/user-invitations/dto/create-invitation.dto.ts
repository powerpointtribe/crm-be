import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({ description: 'Member ID to be invited' })
  @IsNotEmpty()
  @IsMongoId()
  memberId: string;

  @ApiProperty({ description: 'Role ID to assign to the member' })
  @IsNotEmpty()
  @IsMongoId()
  roleId: string;

  @ApiPropertyOptional({ description: 'Additional notes about this invitation' })
  @IsOptional()
  @IsString()
  notes?: string;
}

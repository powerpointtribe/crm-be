import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsString,
  IsArray,
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

  @ApiProperty({ description: 'Campus ID to assign the member to' })
  @IsNotEmpty()
  @IsMongoId()
  branchId: string;

  @ApiPropertyOptional({ description: 'District IDs for Assistant Pastors (optional)' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assignedDistricts?: string[];

  @ApiPropertyOptional({ description: 'Additional notes about this invitation' })
  @IsOptional()
  @IsString()
  notes?: string;
}

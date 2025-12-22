import { IsOptional, IsEnum, IsMongoId, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvitationStatus } from '../schemas/user-invitation.schema';

export class InvitationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by invitation status' })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by role ID' })
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Filter by invited by (admin ID)' })
  @IsOptional()
  @IsMongoId()
  invitedBy?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RevokeInvitationDto {
  @ApiPropertyOptional({ description: 'Reason for revoking the invitation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

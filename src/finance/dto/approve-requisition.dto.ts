import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveRequisitionDto {
  @ApiPropertyOptional({ description: 'Optional notes for the approval' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

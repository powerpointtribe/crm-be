import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DisburseRequisitionDto {
  @ApiPropertyOptional({ description: 'Additional notes about the disbursement' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

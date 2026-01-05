import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DisburseRequisitionDto {
  @ApiProperty({ description: 'Reference number for the disbursement (e.g., transaction ID)' })
  @IsString()
  @IsNotEmpty({ message: 'Disbursement reference is required' })
  disbursementReference: string;

  @ApiPropertyOptional({ description: 'Additional notes about the disbursement' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

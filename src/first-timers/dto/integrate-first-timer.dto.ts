import { IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntegrateFirstTimerDto {
  @ApiProperty({
    description: 'District ID to assign the new member to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  districtId: string;

  @ApiPropertyOptional({
    description: 'Unit ID to assign the new member to (optional)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  unitId?: string;
}

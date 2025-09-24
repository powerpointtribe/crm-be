import { IsNotEmpty, IsMongoId, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignLeadershipDto {
  @ApiProperty({ description: 'Member ID to assign leadership role' })
  @IsMongoId()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Leadership role to assign',
    enum: ['district_pastor', 'champ', 'unit_head'],
  })
  @IsEnum(['district_pastor', 'champ', 'unit_head'])
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({
    description: 'District ID (for district pastor or champ assignments)',
  })
  @IsOptional()
  @IsMongoId()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Unit ID (for unit head assignments)' })
  @IsOptional()
  @IsMongoId()
  unitId?: string;
}

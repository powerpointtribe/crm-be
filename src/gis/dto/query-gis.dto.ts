import { IsOptional, IsString, IsDateString, IsEnum, IsMongoId } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryGisDashboardDto {
  @ApiPropertyOptional({ description: 'Branch ID to filter by (overrides user branch)' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ description: 'Reference date for metrics (ISO string, defaults to now)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class QueryGisTrendsDto {
  @ApiPropertyOptional({ description: 'Branch ID to filter by (overrides user branch)' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ description: 'Number of months to look back', default: '6' })
  @IsOptional()
  @IsString()
  months?: string;

  @ApiPropertyOptional({ enum: ['weekly', 'monthly'], default: 'weekly' })
  @IsOptional()
  @IsEnum(['weekly', 'monthly'])
  period?: 'weekly' | 'monthly';
}

export class QueryGisDistrictDto {
  @ApiPropertyOptional({ description: 'Start date for metrics window' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for metrics window' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

import { IsOptional, IsString, IsDateString, IsEnum, IsMongoId } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryGisDashboardDto {
  @ApiPropertyOptional({ description: 'Branch ID to filter by' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO string, defaults to now)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class QueryGisTrendsDto {
  @ApiPropertyOptional({ description: 'Branch ID to filter by' })
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

import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsMongoId,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchDto } from '../../common/dto/search.dto';
import { ServiceTag } from '../schemas/service-report.schema';

export class ServiceReportSearchDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by branch ID (only for users with branches:view-all permission)',
  })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value === '' ? undefined : value))
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by service tag',
    enum: ServiceTag,
  })
  @IsOptional()
  @IsEnum(ServiceTag)
  serviceTag?: ServiceTag;

  @ApiPropertyOptional({
    description: 'Filter reports from this date onwards (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter reports up to this date (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by reporter ID',
  })
  @IsOptional()
  @IsMongoId()
  reportedBy?: string;

  @ApiPropertyOptional({
    description: 'Filter by service name (partial match)',
    example: 'Sunday Morning',
  })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({
    description: 'Filter by minimum attendance',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAttendance?: number;

  @ApiPropertyOptional({
    description: 'Filter by maximum attendance',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAttendance?: number;

  @ApiPropertyOptional({
    description: 'Filter by minimum number of first timers',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minFirstTimers?: number;

  @ApiPropertyOptional({
    description: 'Include inactive/deleted reports',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

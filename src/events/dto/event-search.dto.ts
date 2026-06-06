import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsMongoId,
  Min,
  IsDate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, EventStatus } from '../schemas/event.schema';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class EventSearchDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term for title/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by event type', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({
    description: 'Filter by event status',
    enum: EventStatus,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Filter by campus ID' })
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter by organizer member ID' })
  @IsOptional()
  @IsMongoId()
  organizerId?: string;

  @ApiPropertyOptional({
    description: 'Filter events starting from this date',
  })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate()
  startDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter events starting until this date',
  })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate()
  startDateTo?: Date;

  @ApiPropertyOptional({ description: 'Filter by tags' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'startDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

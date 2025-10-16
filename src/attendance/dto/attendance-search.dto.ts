import {
  IsOptional,
  IsMongoId,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus, ServiceType } from '../schemas/attendance.schema';

export class AttendanceSearchDto {
  @ApiPropertyOptional({ description: 'Member ID to filter by' })
  @IsOptional()
  @IsMongoId()
  member?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Service type filter', enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({ description: 'Attendance status filter', enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Ministry ID filter' })
  @IsOptional()
  @IsMongoId()
  ministry?: string;

  @ApiPropertyOptional({ description: 'Unit ID filter' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Filter by first-time attendees only' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFirstTimeAttendee?: boolean;

  @ApiPropertyOptional({ description: 'Filter by visitors only' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVisitor?: boolean;

  @ApiPropertyOptional({ description: 'Recorded by user ID' })
  @IsOptional()
  @IsMongoId()
  recordedBy?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'serviceDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'serviceDate';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AttendanceStatsDto {
  @ApiPropertyOptional({ description: 'Start date for stats', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for stats', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Ministry ID for ministry-specific stats' })
  @IsOptional()
  @IsMongoId()
  ministry?: string;

  @ApiPropertyOptional({ description: 'Unit ID for unit-specific stats' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Service type for service-specific stats', enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}
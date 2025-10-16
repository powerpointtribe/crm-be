import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus, ServiceType } from '../schemas/attendance.schema';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Member ID' })
  @IsMongoId()
  @IsNotEmpty()
  member: string;

  @ApiProperty({ description: 'Service date', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  serviceDate: string;

  @ApiProperty({ description: 'Type of service', enum: ServiceType })
  @IsEnum(ServiceType)
  @IsNotEmpty()
  serviceType: ServiceType;

  @ApiPropertyOptional({ description: 'Attendance status', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Ministry ID (for ministry meetings)' })
  @IsOptional()
  @IsMongoId()
  ministry?: string;

  @ApiPropertyOptional({ description: 'Unit ID (for unit meetings)' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Check-in time', example: '2024-01-15T09:30:00Z' })
  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @ApiPropertyOptional({ description: 'Check-out time', example: '2024-01-15T11:30:00Z' })
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Custom service name (if serviceType is OTHER)' })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({ description: 'Service location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Is this their first time attending this service type?', default: false })
  @IsOptional()
  @IsBoolean()
  isFirstTimeAttendee?: boolean;

  @ApiPropertyOptional({ description: 'Is this person a visitor?', default: false })
  @IsOptional()
  @IsBoolean()
  isVisitor?: boolean;

  @ApiPropertyOptional({ description: 'Who invited this visitor (if applicable)' })
  @IsOptional()
  @IsMongoId()
  invitedBy?: string;
}

export class BulkCreateAttendanceDto {
  @ApiProperty({ description: 'Array of attendance records to create', type: [CreateAttendanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttendanceDto)
  attendanceRecords: CreateAttendanceDto[];
}

export class QuickAttendanceDto {
  @ApiProperty({ description: 'Array of member IDs', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  memberIds: string[];

  @ApiProperty({ description: 'Service date', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  serviceDate: string;

  @ApiProperty({ description: 'Type of service', enum: ServiceType })
  @IsEnum(ServiceType)
  @IsNotEmpty()
  serviceType: ServiceType;

  @ApiPropertyOptional({ description: 'Ministry ID (for ministry meetings)' })
  @IsOptional()
  @IsMongoId()
  ministry?: string;

  @ApiPropertyOptional({ description: 'Unit ID (for unit meetings)' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Service location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Custom service name (if serviceType is OTHER)' })
  @IsOptional()
  @IsString()
  serviceName?: string;
}
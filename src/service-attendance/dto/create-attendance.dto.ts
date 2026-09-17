import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsDate,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ServiceType,
  CheckInMethod,
  AttendanceStatus,
} from '../schemas/service-attendance.schema';

const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Member ID' })
  @IsMongoId()
  @IsNotEmpty()
  member: string;

  @ApiProperty({ description: 'Date of the service', example: '2026-09-14' })
  @Transform(transformToDate)
  @IsDate()
  @IsNotEmpty()
  serviceDate: Date;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  @IsNotEmpty()
  serviceType: ServiceType;

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ enum: CheckInMethod })
  @IsOptional()
  @IsEnum(CheckInMethod)
  checkInMethod?: CheckInMethod;

  @ApiPropertyOptional({ description: 'Check-in timestamp' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate()
  checkInTime?: Date;

  @ApiPropertyOptional({ description: 'Service report ID to link to' })
  @IsOptional()
  @IsMongoId()
  serviceReport?: string;

  @ApiPropertyOptional({ description: 'Branch ID (for multi-campus admins)' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

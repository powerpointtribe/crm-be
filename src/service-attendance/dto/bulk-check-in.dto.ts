import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsDate,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ServiceType,
  CheckInMethod,
} from '../schemas/service-attendance.schema';

const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class BulkCheckInDto {
  @ApiProperty({ description: 'Array of member IDs to check in', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  memberIds: string[];

  @ApiProperty({ description: 'Date of the service' })
  @Transform(transformToDate)
  @IsDate()
  @IsNotEmpty()
  serviceDate: Date;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  @IsNotEmpty()
  serviceType: ServiceType;

  @ApiPropertyOptional({ enum: CheckInMethod })
  @IsOptional()
  @IsEnum(CheckInMethod)
  checkInMethod?: CheckInMethod;

  @ApiPropertyOptional({ description: 'Service report ID to link to' })
  @IsOptional()
  @IsMongoId()
  serviceReport?: string;
}

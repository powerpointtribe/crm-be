import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceTag } from '../schemas/service-report.schema';

export class CreateServiceReportDto {
  @ApiProperty({
    description: 'Date of the service (YYYY-MM-DD)',
    example: '2024-11-04',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Name of the service',
    example: 'Sunday Morning Service',
    maxLength: 200,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  serviceName: string;

  @ApiPropertyOptional({
    description: 'Tags associated with the service',
    enum: ServiceTag,
    isArray: true,
    example: [ServiceTag.THEMED_SERVICE, ServiceTag.CELEBRATION_SERVICE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ServiceTag, { each: true })
  @ArrayMaxSize(10)
  serviceTags?: ServiceTag[];

  @ApiProperty({
    description: 'Total number of people in the service',
    example: 150,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalAttendance: number;

  @ApiProperty({
    description: 'Number of males in the service',
    example: 45,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  numberOfMales: number;

  @ApiProperty({
    description: 'Number of females in the service',
    example: 65,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  numberOfFemales: number;

  @ApiProperty({
    description: 'Number of children in the service',
    example: 40,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  numberOfChildren: number;

  @ApiProperty({
    description: 'Number of first-time visitors',
    example: 8,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  numberOfFirstTimers: number;

  @ApiPropertyOptional({
    description: 'Additional notes about the service',
    example: 'Great atmosphere, baptism ceremony included',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

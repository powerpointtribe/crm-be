import { IsNotEmpty, IsString, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '../schemas/service-attendance.schema';

export class QrCheckInDto {
  @ApiProperty({ description: 'Member phone number or email' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'Service date' })
  @IsNotEmpty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  serviceDate: Date;

  @ApiProperty({ enum: ServiceType })
  @IsNotEmpty()
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ApiProperty({ description: 'Branch ID' })
  @IsNotEmpty()
  @IsString()
  branch: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCallReportDto {
  @ApiProperty({ description: 'First timer ID' })
  @IsString()
  @IsNotEmpty()
  firstTimerId: string;

  @ApiProperty({ description: 'Date of the call', example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  callDate: string;

  @ApiProperty({
    description: 'Call status',
    enum: ['successful', 'no_answer', 'busy', 'not_interested', 'interested', 'follow_up_needed', 'completed'],
  })
  @IsEnum(['successful', 'no_answer', 'busy', 'not_interested', 'interested', 'follow_up_needed', 'completed'])
  @IsNotEmpty()
  status: string;

  @ApiProperty({ description: 'Call notes' })
  @IsString()
  @IsNotEmpty()
  notes: string;

  @ApiPropertyOptional({ description: 'Call deductions or observations' })
  @IsOptional()
  @IsString()
  deductions?: string;

  @ApiProperty({
    description: 'Contact method used',
    enum: ['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call'],
  })
  @IsEnum(['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call'])
  @IsNotEmpty()
  contactMethod: string;

  @ApiPropertyOptional({ description: 'Did they attend 2nd service' })
  @IsOptional()
  @IsBoolean()
  attended2ndService?: boolean;

  @ApiPropertyOptional({ description: 'Did they attend 3rd service' })
  @IsOptional()
  @IsBoolean()
  attended3rdService?: boolean;

  @ApiPropertyOptional({ description: 'Did they attend 4th service' })
  @IsOptional()
  @IsBoolean()
  attended4thService?: boolean;

  @ApiPropertyOptional({ description: 'Next follow-up date', example: '2024-01-22T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;

  @ApiProperty({
    description: 'Report number (1-4)',
    minimum: 1,
    maximum: 4
  })
  @IsNumber()
  @Min(1)
  @Max(4)
  reportNumber: number;
}
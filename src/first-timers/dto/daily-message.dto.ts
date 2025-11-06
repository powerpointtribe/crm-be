import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDailyMessageDto {
  @ApiProperty({ description: 'Date for the daily message (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ description: 'Message content to be sent' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Scheduled time to send message (ISO string)',
    example: '2024-01-15T19:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @ApiProperty({ description: 'Whether to send immediately or schedule', default: true })
  @IsBoolean()
  autoSend: boolean;

  @ApiProperty({ description: 'Array of first timer IDs to send message to' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  firstTimerIds: string[];
}

export class DailyMessageQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by message status',
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed']
  })
  @IsOptional()
  @IsString()
  status?: string;
}
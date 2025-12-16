import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditScheduledMessageDto {
  @ApiProperty({ description: 'Updated message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description:
      'Updated scheduled time to send message (defaults to 7PM today or 2hrs after current time)',
    example: '2024-01-15T19:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

export class MessageHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by message status',
    enum: ['scheduled', 'sent', 'failed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}

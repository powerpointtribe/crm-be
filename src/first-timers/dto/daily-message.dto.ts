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

  @ApiPropertyOptional({
    description: 'Whether message requires approval before sending',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'ID of the member who will approve the message',
  })
  @IsOptional()
  @IsString()
  approverId?: string;

  @ApiProperty({
    description: 'Whether to send immediately or schedule (only if not requiring approval)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  @ApiPropertyOptional({ description: 'Array of first timer IDs to send message to (optional - will spool from date if not provided)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  firstTimerIds?: string[];
}

export class DailyMessageQueryDto {
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
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'sending', 'sent', 'failed'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class ApproveDailyMessageDto {
  @ApiPropertyOptional({ description: 'Updated message content (optional)' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Updated scheduled time (optional)' })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;

  @ApiProperty({
    description: 'Whether to send immediately upon approval',
    default: false,
  })
  @IsBoolean()
  sendImmediately: boolean;
}

export class RejectDailyMessageDto {
  @ApiProperty({ description: 'Reason for rejecting the message' })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}

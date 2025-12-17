import { IsString, IsNotEmpty, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDraftDto {
  @ApiPropertyOptional({
    description: 'Title for the message draft. If not provided, defaults to "First Timers Draft for {{date}}"',
    example: 'Welcome Message for New Visitors',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Message content with optional variables like {{firstName}}, {{lastName}}',
    example: 'Hello {{firstName}}, thank you for visiting our church!',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Date when first timers registered (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledDate: string;

  @ApiProperty({
    description: 'Time to send the message (HH:mm format)',
    example: '19:00',
  })
  @IsString()
  @IsNotEmpty()
  scheduledTime: string;
}

export class UpdateMessageDraftDto {
  @ApiPropertyOptional({
    description: 'Title for the message draft',
    example: 'Welcome Message for New Visitors',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Message content with optional variables like {{firstName}}, {{lastName}}',
    example: 'Hello {{firstName}}, thank you for visiting our church!',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    description: 'Date when first timers registered (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({
    description: 'Time to send the message (HH:mm format)',
    example: '19:00',
  })
  @IsString()
  @IsOptional()
  scheduledTime?: string;
}

export class MessageDraftQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'draft',
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class PreviewMessageDto {
  @ApiProperty({
    description: 'Message template with variables',
    example: 'Hello {{firstName}} {{lastName}}, thank you for visiting!',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

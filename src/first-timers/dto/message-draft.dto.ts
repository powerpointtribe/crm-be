import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsMongoId,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDraftDto {
  @ApiPropertyOptional({
    description: 'Title for the message draft',
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

  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Welcome to The PowerPoint Tribe!',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Email template to use (1=Warm, 2=Professional, 3=Vibrant)',
    example: 1,
  })
  @IsNumber()
  @IsIn([1, 2, 3])
  @IsOptional()
  templateId?: number;

  @ApiPropertyOptional({
    description: 'Date when first timers registered (YYYY-MM-DD). Required for by_date mode.',
    example: '2024-01-15',
  })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiProperty({
    description: 'Time to send the message (HH:mm format)',
    example: '19:00',
  })
  @IsString()
  @IsNotEmpty()
  scheduledTime: string;

  @ApiPropertyOptional({
    description: 'How recipients are selected',
    example: 'by_date',
    enum: ['by_date', 'individual'],
  })
  @IsString()
  @IsIn(['by_date', 'individual'])
  @IsOptional()
  recipientMode?: string;

  @ApiPropertyOptional({
    description: 'Array of first-timer IDs (for individual mode)',
    type: [String],
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  recipientIds?: string[];

  @ApiPropertyOptional({
    description: 'Branch ID to scope recipients (auto-set from user if not provided)',
  })
  @IsMongoId()
  @IsOptional()
  branch?: string;
}

export class UpdateMessageDraftDto {
  @ApiPropertyOptional({ description: 'Title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Message content' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Template ID (1, 2, or 3)' })
  @IsNumber()
  @IsIn([1, 2, 3])
  @IsOptional()
  templateId?: number;

  @ApiPropertyOptional({ description: 'Service date (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Send time (HH:mm)' })
  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @ApiPropertyOptional({ description: 'Recipient mode', enum: ['by_date', 'individual'] })
  @IsString()
  @IsIn(['by_date', 'individual'])
  @IsOptional()
  recipientMode?: string;

  @ApiPropertyOptional({ description: 'First-timer IDs (individual mode)', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  recipientIds?: string[];

  @ApiPropertyOptional({ description: 'Branch ID to scope recipients' })
  @IsMongoId()
  @IsOptional()
  branch?: string;
}

export class MessageDraftQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class PreviewMessageDto {
  @ApiProperty({ description: 'Message template with variables' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Template ID (1, 2, or 3)', default: 1 })
  @IsNumber()
  @IsIn([1, 2, 3])
  @IsOptional()
  templateId?: number;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsString()
  @IsOptional()
  subject?: string;
}

export class SendTestEmailDto {
  @ApiProperty({ description: 'Email address to send test to' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Template ID (1, 2, or 3)', default: 1 })
  @IsNumber()
  @IsIn([1, 2, 3])
  @IsOptional()
  templateId?: number;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsString()
  @IsOptional()
  subject?: string;
}

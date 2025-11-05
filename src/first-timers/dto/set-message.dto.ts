import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetPreFilledMessageDto {
  @ApiProperty({ description: 'Pre-filled message to be sent' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description:
      'Scheduled time to send message (defaults to 7PM today or 2hrs after form submission)',
    example: '2024-01-15T19:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

export class BulkSetMessageDto {
  @ApiProperty({
    description: 'Pre-filled message to be sent to all new first-timers',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Array of first-timer IDs to set message for' })
  @IsString({ each: true })
  @IsNotEmpty()
  firstTimerIds: string[];

  @ApiPropertyOptional({
    description:
      'Scheduled time to send message (defaults to 7PM today or 2hrs after form submission)',
    example: '2024-01-15T19:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledTime?: string;
}

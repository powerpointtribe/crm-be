import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFollowUpDto {
  @ApiProperty({
    description: 'Follow-up method',
    enum: ['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call'],
  })
  @IsEnum(['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call'])
  @IsNotEmpty()
  method: string;

  @ApiProperty({
    description: 'Outcome of the follow-up',
    enum: [
      'successful',
      'no_answer',
      'busy',
      'not_interested',
      'interested',
      'follow_up_needed',
    ],
  })
  @IsEnum([
    'successful',
    'no_answer',
    'busy',
    'not_interested',
    'interested',
    'follow_up_needed',
  ])
  @IsNotEmpty()
  outcome: string;

  @ApiPropertyOptional({ description: 'Follow-up notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Member ID who made the contact (auto-set to current member if not provided)',
  })
  @IsOptional()
  @IsMongoId()
  contactedBy?: string;

  @ApiPropertyOptional({ description: 'Next follow-up date' })
  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: Date;
}

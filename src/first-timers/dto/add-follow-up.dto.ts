import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsMongoId,
  ValidateIf,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFollowUpDto {
  @ApiPropertyOptional({
    description: 'Date of the follow-up (defaults to today if not provided)',
    example: '2026-03-24',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    description: 'Follow-up method',
    enum: ['phone', 'email', 'sms', 'whatsapp', 'visit', 'in_visit'],
  })
  @IsEnum(['phone', 'email', 'sms', 'whatsapp', 'visit', 'in_visit'])
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

  @ApiPropertyOptional({
    description: 'Next follow-up date',
    example: '2024-12-25T10:30:00.000Z',
  })
  @IsOptional()
  @ValidateIf((o) => o.nextFollowUpDate !== '' && o.nextFollowUpDate !== null)
  @IsDateString()
  nextFollowUpDate?: string;

  @ApiPropertyOptional({
    description: 'Visit number when method is in_visit (2nd, 3rd, or 4th visit)',
    minimum: 2,
    maximum: 4,
  })
  @IsOptional()
  @ValidateIf((o) => o.method === 'in_visit')
  @IsNumber()
  @Min(2)
  @Max(4)
  visitNumber?: number;
}

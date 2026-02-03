import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsArray,
  IsDate,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecipientFilterType } from '../schemas/email-campaign.schema';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

export class RecipientFilterDto {
  @ApiProperty({
    description: 'Filter type',
    enum: RecipientFilterType,
    default: RecipientFilterType.ALL_MEMBERS,
  })
  @IsEnum(RecipientFilterType)
  filterType: RecipientFilterType;

  @ApiPropertyOptional({ description: 'Branch IDs to filter by' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ description: 'Group IDs to filter by' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  groupIds?: string[];

  @ApiPropertyOptional({ description: 'Unit IDs to filter by' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ description: 'District IDs to filter by' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  districtIds?: string[];

  @ApiPropertyOptional({ description: 'Membership statuses to filter by' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  membershipStatuses?: string[];

  @ApiPropertyOptional({ description: 'Custom member IDs for direct selection' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  customMemberIds?: string[];
}

export class CreateEmailCampaignDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsNotEmpty({ message: 'Branch is required' })
  @IsMongoId()
  branch: string;

  @ApiProperty({ description: 'Campaign name', example: 'Easter Announcement' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'HTML content of the email' })
  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @ApiPropertyOptional({ description: 'Plain text version' })
  @IsOptional()
  @IsString()
  plainTextContent?: string;

  @ApiPropertyOptional({ description: 'Template ID to use as base' })
  @IsOptional()
  @IsMongoId()
  template?: string;

  @ApiPropertyOptional({ description: 'Recipient filter configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientFilterDto)
  recipientFilter?: RecipientFilterDto;
}

export class UpdateEmailCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML content of the email' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Plain text version' })
  @IsOptional()
  @IsString()
  plainTextContent?: string;

  @ApiPropertyOptional({ description: 'Recipient filter configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientFilterDto)
  recipientFilter?: RecipientFilterDto;
}

export class ScheduleCampaignDto {
  @ApiProperty({ description: 'Scheduled send date and time' })
  @IsNotEmpty({ message: 'Scheduled date is required' })
  @Transform(transformToDate)
  @IsDate({ message: 'scheduledAt must be a valid date' })
  scheduledAt: Date;
}

export class SendCampaignDto {
  @ApiPropertyOptional({ description: 'Send test email to specific address before bulk send' })
  @IsOptional()
  @IsString()
  testEmail?: string;
}

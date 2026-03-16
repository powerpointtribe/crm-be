import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerStatus } from '../schemas/event-partner.schema';
import { Type } from 'class-transformer';

// DTO for submitting partnership inquiry from public form
export class SubmitPartnerDto {
  @ApiProperty({ description: 'Partner name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Tech Corp Ltd',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Details about partnership interest',
    example: 'Interested in sponsoring the event with booth space',
  })
  @IsString()
  @IsNotEmpty()
  interestDetails: string;
}

// DTO for updating partner status (admin only)
export class UpdatePartnerStatusDto {
  @ApiProperty({
    description: 'Partner status',
    enum: PartnerStatus,
    example: PartnerStatus.CONTACTED,
  })
  @IsEnum(PartnerStatus)
  @IsNotEmpty()
  status: PartnerStatus;

  @ApiPropertyOptional({
    description: 'Notes about the partner or interaction',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Member ID to assign this partner to',
  })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;
}

// DTO for updating partner details (admin only)
export class UpdatePartnerDetailsDto {
  @ApiPropertyOptional({ description: 'Partner name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Tech Corp Ltd',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Details about partnership interest',
  })
  @IsOptional()
  @IsString()
  interestDetails?: string;

  @ApiPropertyOptional({
    description: 'Notes about the partner',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO for querying/filtering partners (admin only)
export class QueryPartnersDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: PartnerStatus,
  })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;

  @ApiPropertyOptional({
    description: 'Search by name, company, or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned member',
  })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by submission start date (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by submission end date (ISO 8601)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// DTO for contacting a partner via email
export class ContactPartnerDto {
  @ApiProperty({
    description: 'Email subject',
    example: 'Re: Partnership Inquiry for LBS 2026',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Email message body',
    example: 'Thank you for your interest in partnering with us...',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Update partner status after sending email',
    enum: PartnerStatus,
  })
  @IsOptional()
  @IsEnum(PartnerStatus)
  updateStatus?: PartnerStatus;
}

// DTO for bulk email to partners
export class BulkPartnerEmailDto {
  @ApiProperty({
    description: 'Email subject',
    example: 'LBS Partnership Opportunity Update',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Email message body (supports template variables)',
    example: 'Dear {{name}}, we wanted to update you on...',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Filter partners by status',
    enum: PartnerStatus,
    isArray: true,
  })
  @IsOptional()
  @IsEnum(PartnerStatus, { each: true })
  statuses?: PartnerStatus[];

  @ApiPropertyOptional({
    description: 'Specific partner IDs to send to (if provided, ignores status filter)',
    isArray: true,
  })
  @IsOptional()
  @IsMongoId({ each: true })
  partnerIds?: string[];

  @ApiPropertyOptional({
    description: 'Schedule send time (ISO 8601) - if not provided, sends immediately',
    example: '2026-03-01T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

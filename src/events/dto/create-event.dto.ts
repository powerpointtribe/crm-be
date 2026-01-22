import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsNumber,
  IsMongoId,
  IsDate,
  IsEmail,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, EventStatus } from '../schemas/event.schema';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

class LocationDto {
  @ApiProperty({ description: 'Location name', example: 'Main Auditorium' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Is this a virtual event?', default: false })
  @IsBoolean()
  isVirtual: boolean;

  @ApiPropertyOptional({
    description: 'Virtual meeting link (required if isVirtual is true)',
  })
  @IsOptional()
  @IsString()
  virtualLink?: string;
}

class CustomFieldDto {
  @ApiProperty({ description: 'Unique field ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Field label', example: 'Dietary Requirements' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'Field type',
    enum: ['text', 'textarea', 'select', 'checkbox', 'radio'],
  })
  @IsEnum(['text', 'textarea', 'select', 'checkbox', 'radio'])
  type: string;

  @ApiProperty({ description: 'Is this field required?', default: false })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Options for select, checkbox, or radio fields',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

class RegistrationSettingsDto {
  @ApiProperty({
    description: 'Is registration open?',
    default: true,
  })
  @IsBoolean()
  isOpen: boolean;

  @ApiPropertyOptional({ description: 'Maximum number of attendees' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttendees?: number;

  @ApiPropertyOptional({ description: 'Registration deadline' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate()
  deadline?: Date;

  @ApiProperty({
    description: 'Require approval for registrations?',
    default: false,
  })
  @IsBoolean()
  requireApproval: boolean;

  @ApiProperty({
    description: 'Allow waitlist when full?',
    default: true,
  })
  @IsBoolean()
  allowWaitlist: boolean;

  @ApiPropertyOptional({ description: 'Custom registration fields' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDto)
  customFields?: CustomFieldDto[];
}

class CommitteeMemberDto {
  @ApiProperty({ description: 'Member ID' })
  @IsMongoId()
  @IsNotEmpty()
  member: string;

  @ApiProperty({ description: 'Role in the committee', example: 'Coordinator' })
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class CreateEventDto {
  @ApiProperty({ description: 'Event title', example: 'Annual Conference 2025' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Event description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Event type',
    enum: EventType,
    example: EventType.CONFERENCE,
  })
  @IsEnum(EventType)
  @IsNotEmpty()
  type: EventType;

  @ApiPropertyOptional({
    description: 'Event status',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiProperty({ description: 'Event start date', example: '2025-03-15' })
  @Transform(transformToDate)
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ description: 'Event end date', example: '2025-03-17' })
  @Transform(transformToDate)
  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @ApiPropertyOptional({
    description: 'Event start time',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Event end time',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({ description: 'Event location' })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiPropertyOptional({ description: 'Registration settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegistrationSettingsDto)
  registrationSettings?: RegistrationSettingsDto;

  @ApiPropertyOptional({
    description: 'Unique slug for public registration URL',
    example: 'annual-conference-2025',
  })
  @IsOptional()
  @IsString()
  registrationSlug?: string;

  @ApiPropertyOptional({ description: 'Committee members' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitteeMemberDto)
  committee?: CommitteeMemberDto[];

  @ApiPropertyOptional({ description: 'Organizer member ID' })
  @IsOptional()
  @IsMongoId()
  organizer?: string;

  @ApiProperty({ description: 'Branch ID' })
  @IsMongoId()
  @IsNotEmpty()
  branch: string;

  @ApiPropertyOptional({ description: 'Banner image URL' })
  @IsOptional()
  @IsString()
  bannerImage?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Event tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

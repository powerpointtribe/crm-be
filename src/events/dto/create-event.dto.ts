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

// Validation rules for custom fields
class FieldValidationDto {
  @ApiPropertyOptional({ description: 'Minimum length for text fields' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLength?: number;

  @ApiPropertyOptional({ description: 'Maximum length for text fields' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxLength?: number;

  @ApiPropertyOptional({ description: 'Minimum value for number fields' })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional({ description: 'Maximum value for number fields' })
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiPropertyOptional({ description: 'Regex pattern for validation' })
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiPropertyOptional({ description: 'Custom error message for pattern validation' })
  @IsOptional()
  @IsString()
  patternMessage?: string;
}

// Conditional logic rule
class ConditionalRuleDto {
  @ApiProperty({ description: 'ID of the field to check' })
  @IsString()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({
    description: 'Comparison operator',
    enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
  })
  @IsEnum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'])
  operator: string;

  @ApiPropertyOptional({ description: 'Value to compare against' })
  @IsOptional()
  @IsString()
  value?: string;
}

// Conditional logic configuration
class ConditionalLogicDto {
  @ApiProperty({ description: 'Is conditional logic enabled?', default: false })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Action when conditions are met', enum: ['show', 'hide'] })
  @IsEnum(['show', 'hide'])
  action: string;

  @ApiProperty({ description: 'Rules for conditional logic' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionalRuleDto)
  rules: ConditionalRuleDto[];

  @ApiProperty({ description: 'How rules should be evaluated', enum: ['all', 'any'] })
  @IsEnum(['all', 'any'])
  logicType: string;
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
    enum: ['text', 'textarea', 'select', 'checkbox', 'radio', 'email', 'phone', 'number', 'date', 'time', 'rating', 'multi-checkbox'],
  })
  @IsEnum(['text', 'textarea', 'select', 'checkbox', 'radio', 'email', 'phone', 'number', 'date', 'time', 'rating', 'multi-checkbox'])
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

  @ApiPropertyOptional({ description: 'Placeholder text' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text displayed below the field' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ description: 'Field description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Section ID this field belongs to' })
  @IsOptional()
  @IsString()
  sectionId?: string;

  @ApiProperty({ description: 'Display order of the field', default: 0 })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ description: 'Validation rules' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldValidationDto)
  validation?: FieldValidationDto;

  @ApiPropertyOptional({ description: 'Conditional logic configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionalLogicDto)
  conditionalLogic?: ConditionalLogicDto;
}

// Form section DTO
class FormSectionDto {
  @ApiProperty({ description: 'Unique section ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Section title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Section description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Display order', default: 0 })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ description: 'Is section collapsible?', default: false })
  @IsOptional()
  @IsBoolean()
  collapsible?: boolean;

  @ApiPropertyOptional({ description: 'Is section expanded by default?', default: true })
  @IsOptional()
  @IsBoolean()
  defaultExpanded?: boolean;
}

// Form header DTO
class FormHeaderDto {
  @ApiPropertyOptional({ description: 'Custom form title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Custom form description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

// Success message DTO
class SuccessMessageDto {
  @ApiPropertyOptional({ description: 'Success page title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Success message text' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Show check-in QR code?', default: true })
  @IsOptional()
  @IsBoolean()
  showCheckInQR?: boolean;
}

// Terms and conditions DTO
class TermsAndConditionsDto {
  @ApiProperty({ description: 'Are terms enabled?', default: false })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Terms text' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Link to full terms' })
  @IsOptional()
  @IsString()
  linkUrl?: string;
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

  @ApiPropertyOptional({
    description: 'Form layout type',
    enum: ['single-page', 'multi-section'],
    default: 'single-page',
  })
  @IsOptional()
  @IsEnum(['single-page', 'multi-section'])
  formLayout?: string;

  @ApiPropertyOptional({ description: 'Form sections for multi-section layout' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormSectionDto)
  formSections?: FormSectionDto[];

  @ApiPropertyOptional({ description: 'Enable QR code for form sharing?', default: false })
  @IsOptional()
  @IsBoolean()
  qrCodeEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Custom form header' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormHeaderDto)
  formHeader?: FormHeaderDto;

  @ApiPropertyOptional({ description: 'Custom success message' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SuccessMessageDto)
  successMessage?: SuccessMessageDto;

  @ApiPropertyOptional({ description: 'Terms and conditions configuration' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TermsAndConditionsDto)
  termsAndConditions?: TermsAndConditionsDto;

  @ApiPropertyOptional({
    description: 'Form status',
    enum: ['draft', 'live'],
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(['draft', 'live'])
  formStatus?: string;

  @ApiPropertyOptional({
    description: 'Integration mode: embedded form or API',
    enum: ['embedded', 'api'],
    default: 'embedded',
  })
  @IsOptional()
  @IsEnum(['embedded', 'api'])
  integrationMode?: string;

  @ApiPropertyOptional({
    description: 'Auto-generated API key for API integration mode',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;
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

  @ApiPropertyOptional({ description: 'Dedicated website URL for the event' })
  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Event tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

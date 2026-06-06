import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
  IsObject,
  IsEmail,
  IsBoolean,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-types.enum';

// Helper to transform empty strings to undefined
const EmptyStringToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));

class MeetingScheduleDto {
  @ApiPropertyOptional({
    description: 'Meeting day',
    enum: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  })
  @IsOptional()
  @IsString()
  day?: string;

  @ApiPropertyOptional({ description: 'Meeting time', example: '7:00 PM' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({
    description: 'Meeting frequency',
    enum: ['weekly', 'biweekly', 'monthly'],
  })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({
    description: 'Meeting location name',
    example: 'Church Hall A',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Is the meeting virtual/online',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional({
    description: 'Virtual meeting link (Zoom, Teams, etc.)',
    example: 'https://zoom.us/j/123456789',
  })
  @IsOptional()
  @ValidateIf((o) => o.virtualLink !== undefined && o.virtualLink !== null && o.virtualLink !== '')
  @IsUrl()
  virtualLink?: string;

  @ApiPropertyOptional({
    description: 'Physical meeting address (not required for virtual meetings)',
    type: 'object',
    properties: {
      street: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      country: { type: 'string', default: 'Nigeria' },
    },
  })
  @IsOptional()
  @IsObject()
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
  };
}

class HostingInfoDto {
  @ApiPropertyOptional({ description: 'Primary host member ID' })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.hostMember !== undefined && o.hostMember !== null)
  @IsMongoId()
  hostMember?: string;

  @ApiPropertyOptional({ description: 'List of rotating host member IDs' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  rotatingHosts?: string[];

  @ApiPropertyOptional({ description: 'Current host member ID' })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.currentHost !== undefined && o.currentHost !== null)
  @IsMongoId()
  currentHost?: string;
}

export class CreateGroupDto {
  @ApiPropertyOptional({
    description: 'Campus ID (auto-filled from user context if not provided)',
  })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiProperty({ description: 'Group name', example: 'Lagos Island District' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Group type',
    enum: GroupType,
    example: GroupType.DISTRICT,
  })
  @IsEnum(GroupType)
  @IsNotEmpty()
  type: GroupType;

  @ApiPropertyOptional({ description: 'Group description' })
  @IsOptional()
  @IsString()
  description?: string;

  // DISTRICT-SPECIFIC FIELDS
  @ApiPropertyOptional({
    description: 'District Pastor member ID (required for districts)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.districtPastor !== undefined && o.districtPastor !== null)
  @IsMongoId()
  districtPastor?: string;

  // UNIT-SPECIFIC FIELDS
  @ApiPropertyOptional({
    description: 'Unit Head member ID (required for units)',
    example: '507f1f77bcf86cd799439021',
  })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.unitHead !== undefined && o.unitHead !== null)
  @IsMongoId()
  unitHead?: string;

  @ApiPropertyOptional({
    description: 'Assistant Unit Head member ID (for units)',
  })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.assistantUnitHead !== undefined && o.assistantUnitHead !== null)
  @IsMongoId()
  assistantUnitHead?: string;

  // MINISTRY-SPECIFIC FIELDS
  @ApiPropertyOptional({
    description: 'Ministry Director member ID (for ministries)',
  })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.ministryDirector !== undefined && o.ministryDirector !== null)
  @IsMongoId()
  ministryDirector?: string;

  @ApiPropertyOptional({
    description: 'Linked Unit IDs for ministry auto-sync (members in these units auto-join the ministry)',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  linkedUnits?: string[];

  // DEFAULT ROLE
  @ApiPropertyOptional({
    description: 'Default role ID to auto-assign when members join this group',
  })
  @IsOptional()
  @EmptyStringToUndefined()
  @ValidateIf((o) => o.defaultRole !== undefined && o.defaultRole !== null)
  @IsMongoId()
  defaultRole?: string;

  @ApiPropertyOptional({ description: 'Member IDs in this group' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  members?: string[];

  @ApiPropertyOptional({ description: 'Meeting schedule information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MeetingScheduleDto)
  meetingSchedule?: MeetingScheduleDto;

  @ApiPropertyOptional({
    description: 'Hosting information (for districts/home cells)',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HostingInfoDto)
  hostingInfo?: HostingInfoDto;

  @ApiPropertyOptional({ description: 'Maximum capacity', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCapacity?: number;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Group vision statement' })
  @IsOptional()
  @IsString()
  vision?: string;

  @ApiPropertyOptional({ description: 'Group mission statement' })
  @IsOptional()
  @IsString()
  mission?: string;

  @ApiPropertyOptional({ description: 'Group goals and objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];
}

import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  ValidateNested,
  IsObject,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PublicAddressDto {
  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP/Postal code' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string = 'Nigeria';
}

class PublicFamilyMemberDto {
  @ApiProperty({ description: 'Family member name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Family member age' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  age?: number;

  @ApiProperty({ description: 'Relationship to visitor' })
  @IsString()
  @IsNotEmpty()
  relationship: string;
}

export class PublicCreateFirstTimerDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Phone number', example: '+234801234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Address information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PublicAddressDto)
  address?: PublicAddressDto;

  @ApiPropertyOptional({ description: 'Date of birth', example: '1990-01-15' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Occupation' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Alternate contact method' })
  @IsOptional()
  @IsString()
  alternateContactMethod?: string;

  @ApiPropertyOptional({ description: 'Website or personal page' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Social media handles' })
  @IsOptional()
  @IsObject()
  socialMediaHandles?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    tiktok?: string;
    other?: string;
  };

  @ApiPropertyOptional({ description: 'Person who referred them (different from inviter)' })
  @IsOptional()
  @IsString()
  referredBy?: string;

  @ApiPropertyOptional({ description: 'What they enjoyed about the service' })
  @IsOptional()
  @IsString()
  serviceExperience?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({ description: 'Name of person who invited them' })
  @IsOptional()
  @IsString()
  invitedBy?: string;

  @ApiPropertyOptional({
    description: 'How did they hear about the church',
    enum: [
      'friend',
      'family',
      'advertisement',
      'online',
      'event',
      'walkby',
      'website',
      'social_media',
      'other',
    ],
  })
  @IsOptional()
  @IsEnum([
    'friend',
    'family',
    'advertisement',
    'online',
    'event',
    'walkby',
    'website',
    'social_media',
    'other',
  ])
  howDidYouHear?: string;

  @ApiPropertyOptional({ description: 'Previous church attended' })
  @IsOptional()
  @IsString()
  previousChurch?: string;

  @ApiPropertyOptional({
    description: 'Type of visitor',
    enum: ['first_time', 'returning', 'new_to_area', 'church_shopping'],
  })
  @IsOptional()
  @IsEnum(['first_time', 'returning', 'new_to_area', 'church_shopping'])
  visitorType?: string;

  @ApiPropertyOptional({
    description: 'Marital status',
    enum: ['single', 'married', 'divorced', 'widowed'],
  })
  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @ApiPropertyOptional({ description: 'Number of children' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  numberOfChildren?: number;

  @ApiPropertyOptional({ description: 'Family members who visited' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicFamilyMemberDto)
  familyMembers?: PublicFamilyMemberDto[];

  @ApiPropertyOptional({ description: 'Areas of interest' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ description: 'Prayer requests' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prayerRequests?: string[];

  @ApiPropertyOptional({ description: 'Areas interested in serving' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servingInterests?: string[];

  @ApiPropertyOptional({ description: 'Additional notes or comments' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Is interested in joining the church',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  interestedInJoining?: boolean;

  // Additional optional properties to handle frontend form fields

  @ApiPropertyOptional({
    description: 'Date of visit (ignored - auto-set to today)',
  })
  @IsOptional()
  @IsString()
  dateOfVisit?: string;

  @ApiPropertyOptional({ description: 'Service type (ignored in public form)' })
  @IsOptional()
  @IsString()
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Status (ignored in public form)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Converted flag (ignored in public form)',
  })
  @IsOptional()
  @IsBoolean()
  converted?: boolean;

  @ApiPropertyOptional({ description: 'Follow-ups (ignored in public form)' })
  @IsOptional()
  @IsArray()
  followUps?: any[];

  @ApiPropertyOptional({ description: 'Tags (ignored in public form)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

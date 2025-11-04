import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsMongoId,
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

class AddressDto {
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

  @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string = 'Nigeria';
}

class FamilyMemberDto {
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

export class CreateFirstTimerDto {
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
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Address information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ description: 'Date of visit', example: '2024-01-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfVisit must be in YYYY-MM-DD format',
  })
  @IsNotEmpty()
  dateOfVisit: string;

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

  @ApiPropertyOptional({ description: 'Member ID of person who invited them' })
  @IsOptional()
  @IsMongoId()
  invitedByMember?: string;

  @ApiPropertyOptional({ description: 'Member ID to assign follow-up to' })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'How did they hear about the church',
    enum: [
      'friend',
      'family',
      'advertisement',
      'online',
      'event',
      'walkby',
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
  @Type(() => FamilyMemberDto)
  familyMembers?: FamilyMemberDto[];

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

  @ApiPropertyOptional({ description: 'Suggested district for assignment' })
  @IsOptional()
  @IsMongoId()
  suggestedDistrict?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Is interested in joining the tribe',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  interestedInJoining?: boolean;

  @ApiPropertyOptional({
    description: 'GIA leader Member ID (auto-assigned if not provided)',
  })
  @IsOptional()
  @IsMongoId()
  giaLeader?: string;
}

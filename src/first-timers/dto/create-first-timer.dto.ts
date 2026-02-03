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
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message:
      'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)',
  })
  phone: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
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

  @ApiPropertyOptional({ description: 'Date of birth (month and day only)', example: '01-15' })
  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, {
    message: 'dateOfBirth must be in MM-DD format (month and day only)',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Gender',
    enum: ['male', 'female'],
  })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

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

  @ApiPropertyOptional({
    description: 'Person who referred them (different from inviter)',
  })
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
      'outreach',
      'website',
      'social_media',
      'church_outreach',
      'community_outreach',
      'campus_outreach',
      'evangelism_program',
      'crusade',
      'conference',
      'radio',
      'television',
      'podcast',
      'youtube',
      'facebook',
      'instagram',
      'twitter',
      'whatsapp',
      'invitation_card',
      'flyer',
      'banner',
      'billboard',
      'newspaper',
      'magazine',
      'google_search',
      'church_website',
      'online_service',
      'live_stream',
      'church_app',
      'community_service',
      'charity_work',
      'hospital_ministry',
      'prison_ministry',
      'school_ministry',
      'workplace_ministry',
      'neighborhood_evangelism',
      'street_evangelism',
      'door_to_door',
      'market_evangelism',
      'wedding_invitation',
      'funeral_service',
      'baby_dedication',
      'thanksgiving_service',
      'christmas_service',
      'easter_service',
      'new_year_service',
      'special_program',
      'guest_speaker',
      'musical_concert',
      'drama_presentation',
      'youth_program',
      'children_program',
      'women_program',
      'men_program',
      'singles_program',
      'couples_program',
      'business_network',
      'professional_network',
      'alumni_network',
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
    'outreach',
    'website',
    'social_media',
    'church_outreach',
    'community_outreach',
    'campus_outreach',
    'evangelism_program',
    'crusade',
    'conference',
    'radio',
    'television',
    'podcast',
    'youtube',
    'facebook',
    'instagram',
    'twitter',
    'whatsapp',
    'invitation_card',
    'flyer',
    'banner',
    'billboard',
    'newspaper',
    'magazine',
    'google_search',
    'church_website',
    'online_service',
    'live_stream',
    'church_app',
    'community_service',
    'charity_work',
    'hospital_ministry',
    'prison_ministry',
    'school_ministry',
    'workplace_ministry',
    'neighborhood_evangelism',
    'street_evangelism',
    'door_to_door',
    'market_evangelism',
    'wedding_invitation',
    'funeral_service',
    'baby_dedication',
    'thanksgiving_service',
    'christmas_service',
    'easter_service',
    'new_year_service',
    'special_program',
    'guest_speaker',
    'musical_concert',
    'drama_presentation',
    'youth_program',
    'children_program',
    'women_program',
    'men_program',
    'singles_program',
    'couples_program',
    'business_network',
    'professional_network',
    'alumni_network',
    'other',
  ])
  howDidYouHear?: string;

  @ApiPropertyOptional({ description: 'Previous church attended' })
  @IsOptional()
  @IsString()
  previousChurch?: string;

  @ApiPropertyOptional({ description: 'Details about the outreach program' })
  @IsOptional()
  @IsString()
  outreachProgramDetails?: string;

  @ApiPropertyOptional({ description: 'Name of the outreach volunteer' })
  @IsOptional()
  @IsString()
  outreachVolunteerName?: string;

  @ApiPropertyOptional({ description: 'Location where the outreach happened' })
  @IsOptional()
  @IsString()
  outreachLocation?: string;

  @ApiPropertyOptional({
    description: 'Date of the outreach event',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'outreachDate must be in YYYY-MM-DD format',
  })
  outreachDate?: string;

  @ApiPropertyOptional({
    description: 'Effectiveness of the outreach',
    enum: [
      'very_effective',
      'effective',
      'somewhat_effective',
      'not_effective',
      'unknown',
    ],
    default: 'unknown',
  })
  @IsOptional()
  @IsEnum([
    'very_effective',
    'effective',
    'somewhat_effective',
    'not_effective',
    'unknown',
  ])
  outreachEffectiveness?: string;

  @ApiPropertyOptional({ description: 'Feedback about the outreach' })
  @IsOptional()
  @IsString()
  outreachFeedback?: string;

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
    description: 'Interest in joining PowerPoint Tribe',
    enum: ['yes', 'no', 'maybe'],
  })
  @IsOptional()
  @IsEnum(['yes', 'no', 'maybe'])
  interestedInJoining?: string;

  @ApiPropertyOptional({
    description: 'GIA leader Member ID (auto-assigned if not provided)',
  })
  @IsOptional()
  @IsMongoId()
  giaLeader?: string;

  @ApiPropertyOptional({
    description: 'Branch ID - the campus/branch this first-timer belongs to',
  })
  @IsOptional()
  @IsMongoId()
  branch?: string;
}

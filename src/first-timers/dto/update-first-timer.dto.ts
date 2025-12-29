import {
  IsString,
  IsEmail,
  IsOptional,
  IsMongoId,
  ValidateNested,
  IsObject,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Matches,
  ValidateIf,
  IsDate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

// Partial Address DTO for updates - all fields optional
class UpdateAddressDto {
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

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;
}

// Partial Family Member DTO for updates - all fields optional
class UpdateFamilyMemberDto {
  @ApiPropertyOptional({ description: 'Family member name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Family member age' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({ description: 'Relationship to visitor' })
  @IsOptional()
  @IsString()
  relationship?: string;
}

// How did you hear options
const howDidYouHearOptions = [
  'friend',
  'family',
  'advertisement',
  'online',
  'event',
  'walkby',
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
] as const;

export class UpdateFirstTimerDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.phone && o.phone.length > 0)
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Address information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;

  @ApiPropertyOptional({ description: 'Date of visit' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'dateOfVisit must be a valid date' })
  dateOfVisit?: Date;

  @ApiPropertyOptional({ description: 'Date of birth (month and day only)' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female'] })
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

  @ApiPropertyOptional({ description: 'Person who referred them' })
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

  @ApiPropertyOptional({ description: 'How did they hear about the church' })
  @IsOptional()
  @IsEnum(howDidYouHearOptions)
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

  @ApiPropertyOptional({ description: 'Date of the outreach event' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'outreachDate must be a valid date' })
  outreachDate?: Date;

  @ApiPropertyOptional({
    description: 'Effectiveness of the outreach',
    enum: ['very_effective', 'effective', 'somewhat_effective', 'not_effective', 'unknown'],
  })
  @IsOptional()
  @IsEnum(['very_effective', 'effective', 'somewhat_effective', 'not_effective', 'unknown'])
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
  @Type(() => UpdateFamilyMemberDto)
  familyMembers?: UpdateFamilyMemberDto[];

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
    description: 'Interest in joining',
    enum: ['yes', 'no', 'maybe'],
  })
  @IsOptional()
  @IsEnum(['yes', 'no', 'maybe'])
  interestedInJoining?: string;

  @ApiPropertyOptional({ description: 'GIA leader Member ID' })
  @IsOptional()
  @IsMongoId()
  giaLeader?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ description: 'District ID' })
  @IsOptional()
  @IsMongoId()
  district?: string;

  @ApiPropertyOptional({ description: 'Engagement status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Whether follow-up is needed' })
  @IsOptional()
  @IsBoolean()
  needsFollowUp?: boolean;

  @ApiPropertyOptional({ description: 'Whether converted to member' })
  @IsOptional()
  @IsBoolean()
  converted?: boolean;

  @ApiPropertyOptional({ description: 'Whether archived' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional({ description: 'Ready for integration' })
  @IsOptional()
  @IsBoolean()
  readyForIntegration?: boolean;

  @ApiPropertyOptional({ description: 'Follow up date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'followUpDate must be a valid date' })
  followUpDate?: Date;

  @ApiPropertyOptional({ description: 'Next follow up date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'nextFollowUpDate must be a valid date' })
  nextFollowUpDate?: Date;
}

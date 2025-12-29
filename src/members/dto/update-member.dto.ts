import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsObject,
  IsMongoId,
  Matches,
  IsDate,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '../../common/enums/member-status.enum';

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

  @ApiPropertyOptional({ description: 'ZIP/Postal code' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;
}

// Partial Emergency Contact DTO for updates - all fields optional
class UpdateEmergencyContactDto {
  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Relationship to member' })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Emergency contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.phone && o.phone.length > 0)
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.dateOfBirth && o.dateOfBirth.length > 0)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({
    description: 'Marital status',
    enum: ['single', 'married', 'divorced', 'widowed'],
  })
  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @ApiPropertyOptional({ description: 'Member address' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;

  @ApiPropertyOptional({ description: 'Branch/Campus ID' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ description: 'District ID' })
  @IsOptional()
  @IsMongoId()
  district?: string;

  @ApiPropertyOptional({ description: 'Unit/Department ID' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Additional group memberships' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  additionalGroups?: string[];

  @ApiPropertyOptional({
    description: 'Membership status',
    enum: MembershipStatus,
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({ description: 'Date joined church' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'dateJoined must be a valid date' })
  dateJoined?: Date;

  @ApiPropertyOptional({ description: 'Baptism date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'baptismDate must be a valid date' })
  baptismDate?: Date;

  @ApiPropertyOptional({ description: 'Confirmation date' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'confirmationDate must be a valid date' })
  confirmationDate?: Date;

  @ApiPropertyOptional({ description: 'Ministries member is involved in' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ministries?: string[];

  @ApiPropertyOptional({ description: 'Member skills and talents' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Occupation' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Work address' })
  @IsOptional()
  @IsString()
  workAddress?: string;

  @ApiPropertyOptional({ description: 'Spouse member ID' })
  @IsOptional()
  @IsString()
  spouse?: string;

  @ApiPropertyOptional({ description: 'Children member IDs' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  children?: string[];

  @ApiPropertyOptional({ description: 'Parent member ID' })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiPropertyOptional({ description: 'Emergency contact information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateEmergencyContactDto)
  emergencyContact?: UpdateEmergencyContactDto;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({ description: 'Is member active' })
  @IsOptional()
  isActive?: boolean;
}

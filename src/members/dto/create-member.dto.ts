import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsObject,
  IsMongoId,
  Matches,
  IsDate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '../../common/enums/member-status.enum';

// Helper to transform date strings to Date objects
const transformToDate = ({ value }: { value: any }) => {
  if (!value) return value;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
};

class AddressDto {
  @ApiProperty({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State (your base location)', default: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  state: string = 'Lagos';

  @ApiPropertyOptional({ description: 'ZIP/Postal code' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'Nigeria' })
  @IsOptional()
  @IsString()
  country?: string = 'Nigeria';
}

class EmergencyContactDto {
  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Relationship to member' })
  @IsString()
  @IsOptional()
  relationship?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message:
      'Emergency contact phone must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)',
  })
  phone?: string;

  @ApiPropertyOptional({ description: 'Emergency contact email' })
  @IsOptional()
  @IsEmail(
    {},
    { message: 'Please provide a valid email address for emergency contact' },
  )
  email?: string;
}

export class CreateMemberDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Password (auto-generated if not provided)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Phone number', example: '+234801234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message:
      'Phone number must be a valid Nigerian number (e.g., +2348012345678 or 08012345678)',
  })
  phone: string;

  @ApiProperty({ description: 'Date of birth', example: '1990-01-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateOfBirth must be in YYYY-MM-DD format',
  })
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({ description: 'Gender', enum: ['male', 'female'] })
  @IsEnum(['male', 'female'])
  @IsNotEmpty()
  gender: string;

  @ApiPropertyOptional({
    description: 'Marital status',
    enum: ['single', 'married', 'divorced', 'widowed'],
    default: 'single',
  })
  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @ApiProperty({
    description: 'Member address (including base location/state - required)',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  // CHURCH STRUCTURE - Branch, District and Unit Assignments
  @ApiPropertyOptional({
    description: 'Branch/Campus ID (auto-assigned from logged-in user if not provided)',
  })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({
    description:
      'District ID (optional - member can be created without district assignment)',
  })
  @IsOptional()
  @IsMongoId()
  district?: string;

  @ApiPropertyOptional({
    description: 'Unit/Department ID (OPTIONAL but recommended)',
  })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({
    description:
      'Additional group memberships (fellowships, ministries, committees)',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  additionalGroups?: string[];

  @ApiProperty({
    description: 'Membership status',
    enum: MembershipStatus,
  })
  @IsEnum(MembershipStatus)
  @IsNotEmpty()
  membershipStatus: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Date joined church',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'dateJoined must be a valid date' })
  dateJoined?: Date;

  @ApiPropertyOptional({ description: 'Baptism date', example: '2024-03-01' })
  @IsOptional()
  @Transform(transformToDate)
  @IsDate({ message: 'baptismDate must be a valid date' })
  baptismDate?: Date;

  @ApiPropertyOptional({
    description: 'Confirmation date',
    example: '2024-06-01',
  })
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
  @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  IsObject,
  IsMongoId,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '../../common/enums/member-status.enum';

class AddressDto {
  @ApiProperty({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'State', default: 'Lagos' })
  @IsOptional()
  @IsString()
  state?: string = 'Lagos';

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
  phone?: string;

  @ApiPropertyOptional({ description: 'Emergency contact email' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

class LeadershipRolesDto {
  @ApiPropertyOptional({ description: 'Is district pastor', default: false })
  @IsOptional()
  @IsBoolean()
  isDistrictPastor?: boolean = false;

  @ApiPropertyOptional({
    description: 'Is champ (district assistant)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isChamp?: boolean = false;

  @ApiPropertyOptional({ description: 'Is unit head', default: false })
  @IsOptional()
  @IsBoolean()
  isUnitHead?: boolean = false;

  @ApiPropertyOptional({ description: 'District they help as champ' })
  @IsOptional()
  @IsMongoId()
  champForDistrict?: string;

  @ApiPropertyOptional({ description: 'Unit they lead' })
  @IsOptional()
  @IsMongoId()
  leadsUnit?: string;

  @ApiPropertyOptional({ description: 'District they pastor' })
  @IsOptional()
  @IsMongoId()
  pastorsDistrict?: string;
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
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', example: '+234801234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Date of birth', example: '1990-01-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be in YYYY-MM-DD format' })
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

  @ApiPropertyOptional({ description: 'Member address (optional - defaults will be used if not provided)' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  // CHURCH STRUCTURE - District and Unit Assignments
  @ApiPropertyOptional({
    description: 'District ID (optional - member can be created without district assignment)',
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

  @ApiPropertyOptional({ description: 'Leadership roles' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LeadershipRolesDto)
  leadershipRoles?: LeadershipRolesDto;

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
  @IsDateString()
  dateJoined?: Date;

  @ApiPropertyOptional({ description: 'Baptism date', example: '2024-03-01' })
  @IsOptional()
  @IsDateString()
  baptismDate?: Date;

  @ApiPropertyOptional({
    description: 'Confirmation date',
    example: '2024-06-01',
  })
  @IsOptional()
  @IsDateString()
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

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '../../common/enums/member-status.enum';

/**
 * DTO for a single member row in the master import
 */
export class MasterImportMemberDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@church.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'Date of birth (YYYY-MM-DD)', example: '1990-01-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Gender', enum: ['male', 'female'] })
  @IsEnum(['male', 'female'])
  @IsNotEmpty()
  gender: string;

  @ApiPropertyOptional({ description: 'Marital status', enum: ['single', 'married', 'divorced', 'widowed'] })
  @IsOptional()
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  // ============ BRANCH ASSIGNMENT ============
  @ApiProperty({ description: 'Campus name (will be created if not exists)', example: 'Main Campus' })
  @IsString()
  @IsNotEmpty({ message: 'Campus name is required for each member' })
  branchName: string;

  // ============ DISTRICT ASSIGNMENT ============
  @ApiPropertyOptional({ description: 'District name (will be created if not exists)', example: 'District 1 - Ikeja' })
  @IsOptional()
  @IsString()
  districtName?: string;

  @ApiPropertyOptional({ description: 'Is this member the District Pastor?', default: false })
  @IsOptional()
  @IsBoolean()
  isDistrictPastor?: boolean;

  // ============ UNIT ASSIGNMENT ============
  @ApiPropertyOptional({ description: 'Unit name (will be created if not exists)', example: 'Media Unit' })
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiPropertyOptional({ description: 'Is this member the Unit Head?', default: false })
  @IsOptional()
  @IsBoolean()
  isUnitHead?: boolean;

  @ApiPropertyOptional({ description: 'Is this member the Assistant Unit Head?', default: false })
  @IsOptional()
  @IsBoolean()
  isAssistantUnitHead?: boolean;

  // ============ MEMBERSHIP STATUS ============
  @ApiPropertyOptional({
    description: 'Membership status',
    enum: MembershipStatus,
    default: MembershipStatus.MEMBER,
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  // ============ ADDRESS ============
  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State', default: 'Lagos' })
  @IsOptional()
  @IsString()
  state?: string;

  // ============ ADDITIONAL INFO ============
  @ApiPropertyOptional({ description: 'Occupation' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ description: 'Date joined church (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateJoined?: string;

  @ApiPropertyOptional({ description: 'Notes or additional info' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Main DTO for the master bulk import endpoint
 */
export class BulkImportMasterDto {
  @ApiProperty({
    description: 'Array of members to import',
    type: [MasterImportMemberDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterImportMemberDto)
  members: MasterImportMemberDto[];

  @ApiPropertyOptional({
    description: 'Default password for all new members (if not using generated passwords)',
    example: 'WelcomeToChurch123!',
  })
  @IsOptional()
  @IsString()
  defaultPassword?: string;

  @ApiPropertyOptional({
    description: 'Whether to skip members that already exist (by email)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  skipExisting?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to send welcome emails to new members',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmails?: boolean;
}

/**
 * Response DTO for bulk import results
 */
export class BulkImportMasterResultDto {
  @ApiProperty({ description: 'Total number of rows processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'Number of members successfully created' })
  membersCreated: number;

  @ApiProperty({ description: 'Number of members skipped (already exist)' })
  membersSkipped: number;

  @ApiProperty({ description: 'Number of campuses created' })
  branchesCreated: number;

  @ApiProperty({ description: 'Number of districts created' })
  districtsCreated: number;

  @ApiProperty({ description: 'Number of units created' })
  unitsCreated: number;

  @ApiProperty({ description: 'Number of district pastors assigned' })
  districtPastorsAssigned: number;

  @ApiProperty({ description: 'Number of unit heads assigned' })
  unitHeadsAssigned: number;

  @ApiProperty({ description: 'List of errors encountered' })
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;

  @ApiProperty({ description: 'List of successfully created member IDs' })
  createdMemberIds: string[];
}

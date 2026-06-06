import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsMongoId,
  IsArray,
  IsIn,
  ValidateNested,
  IsDateString,
  MaxLength,
  IsNotEmpty,
  ArrayMinSize,
  Length,
  IsEmail,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CostBreakdownItemDto, BankAccountDto } from './create-requisition.dto';
import { ActionTokenType } from '../schemas/action-token.schema';

/**
 * DTO for public requisition submission (no auth required)
 */
export class PublicCreateRequisitionDto {
  // Submitter info (required for public submissions)
  @ApiProperty({ description: 'Name of the person submitting the requisition' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  submitterName: string;

  @ApiProperty({ description: 'Email of the submitter for notifications' })
  @IsEmail()
  @IsNotEmpty()
  submitterEmail: string;

  @ApiPropertyOptional({ description: 'Phone number of the submitter' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  submitterPhone?: string;

  // Branch identification
  @ApiProperty({ description: 'Campus slug for the requisition (e.g., lagos-mainland)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Branch slug must be lowercase alphanumeric with hyphens' })
  branchSlug: string;

  // Unit selection - either a group ID or custom text
  @ApiPropertyOptional({ description: 'Unit/Group ID for the requisition' })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({ description: 'Custom unit name if "Others" is selected' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customUnit?: string;

  @ApiProperty({ description: 'Expense category ID' })
  @IsMongoId()
  @IsNotEmpty()
  expenseCategory: string;

  @ApiProperty({ description: 'Description of the event/purpose', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  eventDescription: string;

  @ApiProperty({ description: 'Date when the funds are needed' })
  @IsDateString()
  @IsNotEmpty()
  dateNeeded: string;

  @ApiPropertyOptional({ description: 'When a similar request was last made' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lastRequest?: string;

  @ApiProperty({
    description: 'Breakdown of costs',
    type: [CostBreakdownItemDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'At least one cost breakdown item is required' })
  @Type(() => CostBreakdownItemDto)
  costBreakdown: CostBreakdownItemDto[];

  @ApiProperty({ description: 'Bank account details for disbursement' })
  @ValidateNested()
  @Type(() => BankAccountDto)
  creditAccount: BankAccountDto;

  @ApiPropertyOptional({ description: 'URLs of supporting documents' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];

  @ApiProperty({
    description: 'Whether this has been discussed with P.Dams',
    enum: ['yes', 'not_required', 'no'],
  })
  @IsString()
  @IsIn(['yes', 'not_required', 'no'], { message: 'discussedWithPDams must be one of: yes, not_required, no' })
  discussedWithPDams: 'yes' | 'not_required' | 'no';

  @ApiPropertyOptional({ description: 'Date when discussed with P.Dams' })
  @IsOptional()
  @IsDateString()
  discussedDate?: string;
}

/**
 * DTO for token-based approval
 */
export class PublicApproveDto {
  @ApiProperty({ description: 'Action token for approval' })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Token must be exactly 64 characters' })
  token: string;

  @ApiPropertyOptional({ description: 'Approval notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * DTO for token-based rejection
 */
export class PublicRejectDto {
  @ApiProperty({ description: 'Action token for rejection' })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Token must be exactly 64 characters' })
  token: string;

  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

/**
 * DTO for token-based disbursement
 */
export class PublicDisburseDto {
  @ApiProperty({ description: 'Action token for disbursement' })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Token must be exactly 64 characters' })
  token: string;

  @ApiPropertyOptional({ description: 'Additional notes about disbursement' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * Response DTO for token verification
 */
export class TokenVerificationResponseDto {
  @ApiProperty({ description: 'Whether the token is valid' })
  valid: boolean;

  @ApiPropertyOptional({ description: 'The action type of the token' })
  actionType?: ActionTokenType;

  @ApiPropertyOptional({ description: 'The requisition details (if valid)' })
  requisition?: any;

  @ApiPropertyOptional({ description: 'Error message if invalid' })
  error?: string;

  @ApiPropertyOptional({ description: 'Token expiration time' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Recipient email' })
  recipientEmail?: string;
}

/**
 * Public branch response DTO
 */
export class PublicBranchDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  address?: {
    city?: string;
    state?: string;
  };
}

/**
 * Public expense category response DTO
 */
export class PublicExpenseCategoryDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;
}

/**
 * DTO for checking LXL eligibility by email
 */
export class CheckLxlEligibilityDto {
  @ApiProperty({ description: 'Email address to check for LXL eligibility' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Campus slug for the requisition' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Branch slug must be lowercase alphanumeric with hyphens' })
  branchSlug: string;
}

/**
 * Response DTO for LXL eligibility check
 */
export class LxlEligibilityResponseDto {
  @ApiProperty({ description: 'Whether the member is eligible to raise requisitions' })
  eligible: boolean;

  @ApiPropertyOptional({ description: 'Member name if found and eligible' })
  memberName?: string;

  @ApiPropertyOptional({ description: 'Reason for ineligibility' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Member\'s leadership role if applicable' })
  leadershipRole?: string;
}

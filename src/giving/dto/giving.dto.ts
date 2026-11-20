import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ACCOUNT_CURRENCIES,
  AccountApprovalStatus,
  type AccountCurrency,
  DONATION_FUNDS,
  type DonationFund,
  DonationStatus,
} from '../schemas/giving.schemas';

// ─── Giving accounts (staff) ──────────────────────────────────────────

export class CreateGivingAccountDto {
  @ApiProperty({ enum: ACCOUNT_CURRENCIES })
  @IsIn(ACCOUNT_CURRENCIES)
  currency: AccountCurrency;

  @ApiProperty({ example: 'Zenith Bank Plc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bank: string;

  @ApiProperty({ example: '1221642022', description: '6-20 digits' })
  @Matches(/^\d{6,20}$/, { message: 'accountNumber must be 6-20 digits' })
  accountNumber: string;

  @ApiPropertyOptional({ example: 'The Powerpoint Tribesmen Chris. Min.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountName?: string | null;

  @ApiPropertyOptional({
    example: 'ZEIBNGLA',
    description: '8 or 11 characters',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/, {
    message: 'swift must be 8 or 11 letters/digits',
  })
  swift?: string | null;

  @ApiPropertyOptional({
    description: 'Branch (campus) id; null = all campuses',
  })
  @IsOptional()
  @IsMongoId()
  branch?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}

export class UpdateGivingAccountDto extends PartialType(
  CreateGivingAccountDto,
) {}

export class GivingAccountQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Bank, account name or number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_CURRENCIES })
  @IsOptional()
  @IsIn(ACCOUNT_CURRENCIES)
  currency?: AccountCurrency;

  @ApiPropertyOptional({ enum: AccountApprovalStatus })
  @IsOptional()
  @IsEnum(AccountApprovalStatus)
  approvalStatus?: AccountApprovalStatus;

  @ApiPropertyOptional({
    description: 'Branch id, or "none" for shared accounts',
  })
  @IsOptional()
  @Matches(/^([a-f\d]{24}|none)$/i)
  branch?: string;
}

// ─── Donations (public) ───────────────────────────────────────────────

export class SourceUtmDto {
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsOptional() @IsString() @MaxLength(100) medium?: string;
  @IsOptional() @IsString() @MaxLength(100) campaign?: string;
  @IsOptional() @IsString() @MaxLength(100) term?: string;
  @IsOptional() @IsString() @MaxLength(100) content?: string;
}

/** Where the form was submitted from (page path + utm_*). */
export class SourceDto {
  @ApiPropertyOptional({ example: '/give' })
  @IsOptional()
  @Matches(/^\/[^\s]{0,199}$/, { message: 'source.page must be a site path' })
  page?: string;

  @ApiPropertyOptional({ type: SourceUtmDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SourceUtmDto)
  utm?: SourceUtmDto;
}

export class CreateDonationDto {
  @ApiProperty({ enum: DONATION_FUNDS })
  @IsIn(DONATION_FUNDS)
  fund: DonationFund;

  @ApiProperty({ example: 'ppt-anthony', description: 'Campus (branch) slug' })
  @Matches(/^[a-z0-9-]{1,80}$/, { message: 'branch must be a campus slug' })
  branch: string;

  @ApiProperty({ example: 5000, description: 'Naira, ₦100 to ₦10,000,000' })
  @Type(() => Number)
  @IsInt({ message: 'amount must be a whole number of naira' })
  @Min(100, { message: 'The smallest online gift is ₦100' })
  @Max(10_000_000, { message: 'The largest online gift is ₦10,000,000' })
  amount: number;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: '+2348030000000' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Honeypot: must be empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ type: SourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SourceDto)
  source?: SourceDto;
}

export class PublicAccountsQueryDto {
  @ApiPropertyOptional({ example: 'ppt-anthony', description: 'Campus slug' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,80}$/, { message: 'branch must be a campus slug' })
  branch?: string;
}

// ─── Donations (staff) ────────────────────────────────────────────────

export class DonationRangeDto {
  @ApiPropertyOptional({ description: 'From (inclusive), ISO date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'To (exclusive), ISO date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class DonationQueryDto extends DonationRangeDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: DONATION_FUNDS })
  @IsOptional()
  @IsIn(DONATION_FUNDS)
  fund?: DonationFund;

  @ApiPropertyOptional({ description: 'Branch id' })
  @IsOptional()
  @IsMongoId()
  branch?: string;

  @ApiPropertyOptional({ enum: DonationStatus })
  @IsOptional()
  @IsEnum(DonationStatus)
  status?: DonationStatus;

  @ApiPropertyOptional({
    description: 'Reference, receipt number or donor email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

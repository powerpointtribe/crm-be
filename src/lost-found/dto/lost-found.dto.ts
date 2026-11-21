import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxDate,
  MaxLength,
  Min,
  MinDate,
} from 'class-validator';
import { SearchDto } from '../../common/dto/search.dto';
import { ClaimStatus } from '../schemas/lost-item-claim.schema';
import { LostItemStatus, LostItemType } from '../schemas/lost-item.schema';

const HTTPS = { protocols: ['https'], require_protocol: true };
/** Any common phone format: digits, spaces, dashes, brackets, leading +. */
export const PHONE = /^\+?[0-9(][0-9 ()-]{5,18}[0-9]$/;

/** Up to a day ahead allows for time zones; nothing from the far past. */
const latestFoundOn = () => new Date(Date.now() + 86_400_000);

// ─── Public ────────────────────────────────────────────────────────────

export class PublicLostItemsQueryDto {
  @ApiPropertyOptional({ enum: LostItemType })
  @IsOptional()
  @IsEnum(LostItemType)
  type?: LostItemType;

  @ApiPropertyOptional({ description: 'Campus (branch) slug' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,80}$/, { message: 'branch must be a campus slug' })
  branch?: string;

  @ApiPropertyOptional({ description: 'Matches the item description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 24, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number = 8;
}

export class CreateClaimDto {
  @ApiProperty({ example: 'Ada Obi' })
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty({ example: '0803 123 4567' })
  @IsString()
  @Matches(PHONE, { message: 'Enter a valid phone number.' })
  phone: string;

  @ApiProperty({
    description: 'How we know it is yours',
    example: 'Blue bottle with my initials A.O.',
  })
  @IsString()
  @Length(5, 500)
  proof: string;

  /** Honeypot: real people leave it empty. */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

// ─── Staff ─────────────────────────────────────────────────────────────

export class CreateLostItemDto {
  @ApiProperty({ example: 'Black umbrella' })
  @IsString()
  @Length(3, 200)
  description: string;

  @ApiProperty({ enum: LostItemType })
  @IsEnum(LostItemType)
  type: LostItemType;

  @ApiProperty({ description: 'Day it was found' })
  @Type(() => Date)
  @IsDate()
  @MinDate(new Date('2020-01-01'))
  @MaxDate(latestFoundOn)
  foundOn: Date;

  @ApiPropertyOptional({ description: 'From POST /upload/website-image' })
  @IsOptional()
  @IsUrl(HTTPS)
  photoUrl?: string | null;

  @ApiProperty({ description: 'Campus (branch) id' })
  @IsMongoId()
  branch: string;

  @ApiPropertyOptional({
    enum: [LostItemStatus.PENDING_REVIEW, LostItemStatus.LISTED],
    description: 'Listing straight away needs lost-found:manage',
  })
  @IsOptional()
  @IsIn([LostItemStatus.PENDING_REVIEW, LostItemStatus.LISTED])
  status?: LostItemStatus;
}

export class UpdateLostItemDto extends PartialType(CreateLostItemDto) {
  @ApiPropertyOptional({ enum: LostItemStatus })
  @IsOptional()
  @IsEnum(LostItemStatus)
  status?: LostItemStatus;
}

export class LostItemsQueryDto extends SearchDto {
  @ApiPropertyOptional({ enum: LostItemStatus })
  @IsOptional()
  @IsEnum(LostItemStatus)
  status?: LostItemStatus;

  @ApiPropertyOptional({ enum: LostItemType })
  @IsOptional()
  @IsEnum(LostItemType)
  type?: LostItemType;

  @ApiPropertyOptional({ description: 'Branch id' })
  @IsOptional()
  @IsMongoId()
  branch?: string;
}

export class ClaimsQueryDto extends SearchDto {
  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;
}

export class ReviewClaimDto {
  @ApiProperty({ enum: [ClaimStatus.APPROVED, ClaimStatus.REJECTED] })
  @IsIn([ClaimStatus.APPROVED, ClaimStatus.REJECTED])
  status: ClaimStatus.APPROVED | ClaimStatus.REJECTED;
}

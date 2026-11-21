import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HTTPS = { protocols: ['https'], require_protocol: true };

export class BranchServiceTimeDto {
  @IsString() @IsNotEmpty() @MaxLength(60) label: string;
  @IsString() @IsNotEmpty() @MaxLength(40) day: string;
  @IsString() @IsNotEmpty() @MaxLength(40) time: string;
}

/**
 * PATCH /branches/:id/website — how a campus appears on the public website.
 * Only keys that are sent change; `null` clears a field.
 */
export class UpdateBranchWebsiteDto {
  @ApiPropertyOptional({ description: 'List this campus on the website' })
  @IsOptional()
  @IsBoolean()
  showOnWebsite?: boolean;

  @ApiPropertyOptional({ example: 'Anthony Village, Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  venue?: string | null;

  @ApiPropertyOptional({ description: 'Google Maps link (https)' })
  @IsOptional()
  @IsUrl(HTTPS)
  mapUrl?: string | null;

  @ApiPropertyOptional({ description: 'Campus photo (https)' })
  @IsOptional()
  @IsUrl(HTTPS)
  photoUrl?: string | null;

  @ApiPropertyOptional({ type: [BranchServiceTimeDto], maxItems: 12 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => BranchServiceTimeDto)
  serviceTimes?: BranchServiceTimeDto[];

  @ApiPropertyOptional({ description: 'Lower shows first' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  order?: number;

  @ApiPropertyOptional({ description: 'Website pastor id (web_pastors)' })
  @IsOptional()
  @IsMongoId()
  pastor?: string | null;
}

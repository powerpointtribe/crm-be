import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxDate,
  MaxLength,
  MinDate,
  ValidateNested,
} from 'class-validator';

const HTTPS = { protocols: ['https'], require_protocol: true };

export class ServiceStripItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  day: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  time: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  note?: string;
}

/** Each key: an https URL, or null to hide that platform. */
export class PlatformUrlsDto {
  @IsOptional() @IsUrl(HTTPS) youtube?: string | null;
  @IsOptional() @IsUrl(HTTPS) spotify?: string | null;
  @IsOptional() @IsUrl(HTTPS) mixlr?: string | null;
  @IsOptional() @IsUrl(HTTPS) soundcloud?: string | null;
  @IsOptional() @IsUrl(HTTPS) medium?: string | null;
  @IsOptional() @IsUrl(HTTPS) instagram?: string | null;
  @IsOptional() @IsUrl(HTTPS) facebook?: string | null;
  @IsOptional() @IsUrl(HTTPS) x?: string | null;
}

export class HeroVideoDto {
  @IsOptional() @IsUrl(HTTPS) url?: string | null;
  @IsOptional() @IsUrl(HTTPS) posterUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(200) posterAlt?: string | null;
}

export class ContactEmailsDto {
  @IsOptional() @IsEmail() general?: string | null;
  @IsOptional() @IsEmail() finance?: string | null;
  @IsOptional() @IsEmail() welfare?: string | null;
  @IsOptional() @IsEmail() media?: string | null;
}

/**
 * PATCH /website/settings. Only keys that are sent change. `platformUrls`,
 * `heroVideo` and `contactEmails` merge per key; `serviceStrip` is replaced.
 */
export class UpdateWebsiteSettingsDto {
  @ApiPropertyOptional({ type: [ServiceStripItemDto], maxItems: 8 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ServiceStripItemDto)
  serviceStrip?: ServiceStripItemDto[];

  @ApiPropertyOptional({ type: PlatformUrlsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformUrlsDto)
  platformUrls?: PlatformUrlsDto;

  @ApiPropertyOptional({ type: HeroVideoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HeroVideoDto)
  heroVideo?: HeroVideoDto;

  @ApiPropertyOptional({ description: "Next David's Company cohort" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(new Date('2000-01-01'))
  @MaxDate(new Date('2200-01-01'))
  dcCohortDate?: Date | null;

  @ApiPropertyOptional({ type: ContactEmailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactEmailsDto)
  contactEmails?: ContactEmailsDto;
}

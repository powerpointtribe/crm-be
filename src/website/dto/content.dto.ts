import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxDate,
  MaxLength,
  Min,
  MinDate,
} from 'class-validator';
import { SearchDto } from '../../common/dto/search.dto';
import { PublishStatus } from '../schemas/publishing';
import { FaqPage, SnippetKind } from '../schemas/web-content.schema';
import { SermonService } from '../schemas/web-sermon.schema';

/*
 * Staff write bodies for website content. `@IsOptional()` also lets `null`
 * through, which is how a field is cleared on PATCH.
 */

const HTTPS = { protocols: ['https'], require_protocol: true };
const MIN_DATE = new Date('1900-01-01');
const MAX_DATE = new Date('2200-01-01');

class PublishFieldsDto {
  @ApiPropertyOptional({ enum: PublishStatus, default: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ description: 'Publish automatically at this time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(MIN_DATE)
  @MaxDate(MAX_DATE)
  publishAt?: Date | null;
}

/** Keys that need `website:publish-content` on top of create/update. */
export const PUBLISH_KEYS = ['status', 'publishAt'] as const;

// ─── Sermons ───────────────────────────────────────────────────────────

export class CreateWebSermonDto extends PublishFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Made from the title when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiProperty({ description: 'When it was preached' })
  @Type(() => Date)
  @IsDate()
  @MinDate(MIN_DATE)
  @MaxDate(MAX_DATE)
  date: Date;

  @ApiProperty({ enum: SermonService })
  @IsEnum(SermonService)
  service: SermonService;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  speaker: string;

  @ApiPropertyOptional({ example: 'dQw4w9WgXcQ' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{11}$/, {
    message: 'youtubeId must be the 11-character video id',
  })
  youtubeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTPS)
  audioUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTPS)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  durationMin?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  partNumber?: number | null;

  @ApiPropertyOptional({
    description: 'Branch (campus) id; null = all campuses',
  })
  @IsOptional()
  @IsMongoId()
  branch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  series?: string | null;

  @ApiPropertyOptional({ description: 'Website pastor id' })
  @IsOptional()
  @IsMongoId()
  speakerPastor?: string | null;
}
export class UpdateWebSermonDto extends PartialType(CreateWebSermonDto) {}

// ─── Series ────────────────────────────────────────────────────────────

export class CreateWebSeriesDto extends PublishFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @MinDate(MIN_DATE)
  @MaxDate(MAX_DATE)
  startDate: Date;

  @ApiPropertyOptional({ description: '16:9 artwork' })
  @IsOptional()
  @IsUrl(HTTPS)
  artworkUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  artworkAlt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: 'Bible Study' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  speaker?: string | null;
}
export class UpdateWebSeriesDto extends PartialType(CreateWebSeriesDto) {}

// ─── Devotionals ───────────────────────────────────────────────────────

export class CreateWebDevotionalDto extends PublishFieldsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @MinDate(MIN_DATE)
  @MaxDate(MAX_DATE)
  date: Date;

  @ApiPropertyOptional({ description: 'Medium post' })
  @IsOptional()
  @IsUrl(HTTPS)
  url?: string | null;

  @ApiPropertyOptional({ description: 'Spotify episode' })
  @IsOptional()
  @IsUrl(HTTPS)
  audioUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string | null;
}
export class UpdateWebDevotionalDto extends PartialType(
  CreateWebDevotionalDto,
) {}

// ─── Pastors ───────────────────────────────────────────────────────────

class OrderedDto extends PublishFieldsDto {
  @ApiPropertyOptional({ description: 'Lower shows first', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  order?: number;
}

export class CreateWebPastorDto extends OrderedDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Lead Pastor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTPS)
  photoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  photoAlt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branch?: string | null;

  @ApiPropertyOptional({ description: 'Linked CRM member' })
  @IsOptional()
  @IsMongoId()
  member?: string | null;
}
export class UpdateWebPastorDto extends PartialType(CreateWebPastorDto) {}

// ─── Testimonies ───────────────────────────────────────────────────────

export class CreateWebTestimonyDto extends OrderedDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(HTTPS)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  branch?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @ApiPropertyOptional({
    description: 'Event testimony this was promoted from',
  })
  @IsOptional()
  @IsMongoId()
  sourceTestimony?: string | null;
}
export class UpdateWebTestimonyDto extends PartialType(CreateWebTestimonyDto) {}

// ─── Snippets ──────────────────────────────────────────────────────────

export class CreateWebSnippetDto extends OrderedDto {
  @ApiProperty({ enum: SnippetKind })
  @IsEnum(SnippetKind)
  kind: SnippetKind;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;
}
export class UpdateWebSnippetDto extends PartialType(CreateWebSnippetDto) {}

// ─── FAQs ──────────────────────────────────────────────────────────────

export class CreateWebFaqDto extends OrderedDto {
  @ApiProperty({ enum: FaqPage })
  @IsEnum(FaqPage)
  page: FaqPage;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  question: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
export class UpdateWebFaqDto extends PartialType(CreateWebFaqDto) {}

// ─── Staff list query ──────────────────────────────────────────────────

export class ContentListQueryDto extends SearchDto {
  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({
    description: 'Branch id, or "none" for all-campus items',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([a-f\d]{24}|none)$/i)
  branch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  series?: string;

  @ApiPropertyOptional({ enum: SermonService })
  @IsOptional()
  @IsEnum(SermonService)
  service?: SermonService;

  @ApiPropertyOptional({ enum: SnippetKind })
  @IsOptional()
  @IsEnum(SnippetKind)
  kind?: SnippetKind;

  /** FAQ page filter (`page` is taken by pagination). */
  @ApiPropertyOptional({ enum: FaqPage })
  @IsOptional()
  @IsEnum(FaqPage)
  faqPage?: FaqPage;
}

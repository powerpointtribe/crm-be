import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FaqPage, SnippetKind } from '../schemas/web-content.schema';

/** Public lists: smaller pages than staff lists (default 8, max 24). */
export class PublicPageDto {
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

const CSV_OF_SLUGS = /^[a-z0-9-]+(,[a-z0-9-]+)*$/;

export class PublicSermonQueryDto extends PublicPageDto {
  @ApiPropertyOptional({ description: 'Title, speaker or series title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Comma list of sunday, bible_study, special',
    example: 'sunday,bible_study',
  })
  @IsOptional()
  @Matches(/^(sunday|bible_study|special)(,(sunday|bible_study|special))*$/, {
    message: 'service must be a comma list of sunday, bible_study, special',
  })
  service?: string;

  @ApiPropertyOptional({ description: 'Comma list of campus (branch) slugs' })
  @IsOptional()
  @Matches(CSV_OF_SLUGS, { message: 'branch must be a comma list of slugs' })
  branch?: string;

  @ApiPropertyOptional({ enum: ['newest', 'oldest', 'az'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'oldest', 'az'])
  sort?: 'newest' | 'oldest' | 'az' = 'newest';
}

export class PublicSeriesPartsQueryDto extends PublicPageDto {
  @ApiPropertyOptional({ enum: ['newest', 'oldest'], default: 'oldest' })
  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort?: 'newest' | 'oldest' = 'oldest';
}

export class PublicDevotionalQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 12, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number = 3;
}

export class PublicSnippetQueryDto {
  @ApiPropertyOptional({ enum: SnippetKind })
  @IsEnum(SnippetKind)
  kind: SnippetKind;
}

export class PublicFaqQueryDto {
  @ApiPropertyOptional({ enum: FaqPage })
  @IsEnum(FaqPage)
  page: FaqPage;
}

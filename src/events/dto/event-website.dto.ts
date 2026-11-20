import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WebsiteEventKind } from '../schemas/event.schema';

/** PATCH /events/:id/website. Only keys that are sent change; null clears. */
export class UpdateEventWebsiteDto {
  @ApiPropertyOptional({ description: 'List this event on the website' })
  @IsOptional()
  @IsBoolean()
  showOnWebsite?: boolean;

  @ApiPropertyOptional({ enum: WebsiteEventKind })
  @IsOptional()
  @IsEnum(WebsiteEventKind)
  kind?: WebsiteEventKind;

  @ApiPropertyOptional({ example: 'Word conference' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  typeLabel?: string | null;

  @ApiPropertyOptional({ description: 'Use for the website countdown' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'https URL or a site path such as /visit',
  })
  @IsOptional()
  @Matches(/^(https:\/\/[^\s]+|\/[A-Za-z0-9/_\-?=&#.%]*)$/, {
    message: 'link must be an https URL or a path starting with /',
  })
  @MaxLength(500)
  link?: string | null;
}

export class WebsiteEventsQueryDto {
  @ApiPropertyOptional({ description: 'Campus (branch) slug' })
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/)
  branch?: string;

  @ApiPropertyOptional({ enum: WebsiteEventKind, default: 'one_off' })
  @IsOptional()
  @IsEnum(WebsiteEventKind)
  kind?: WebsiteEventKind = WebsiteEventKind.ONE_OFF;

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

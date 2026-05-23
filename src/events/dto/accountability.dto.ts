import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsNotEmpty,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordAccountabilityDto {
  @ApiProperty({ description: 'Registration ID' })
  @IsMongoId()
  @IsNotEmpty()
  registrationId: string;

  @ApiProperty({ description: 'Week number (1-12)', minimum: 1, maximum: 12 })
  @IsNumber()
  @Min(1)
  @Max(12)
  week: number;

  @ApiPropertyOptional({ description: 'Week start date' })
  @IsString()
  @IsOptional()
  weekStartDate?: string;

  @ApiPropertyOptional({ description: 'Platform (Instagram, YouTube, X, TikTok, etc.)' })
  @IsString()
  @IsOptional()
  platform?: string;

  @ApiProperty({ description: 'Number of posts this week', minimum: 0 })
  @IsNumber()
  @Min(0)
  postCount: number;

  @ApiPropertyOptional({ description: 'Links to posts', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  postLinks?: string[];

  @ApiProperty({ description: 'Engagement rate (%)', minimum: 0 })
  @IsNumber()
  @Min(0)
  engagementRate: number;

  @ApiProperty({ description: 'Net follower growth' })
  @IsNumber()
  followerGrowth: number;

  @ApiProperty({ description: 'Consistency score (1-10)', minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  consistencyScore: number;

  @ApiPropertyOptional({ description: 'Peer review score (1-10)', minimum: 0, maximum: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  peerReviewScore?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AccountabilityQueryDto {
  @ApiPropertyOptional({ description: 'Filter by week number' })
  @IsOptional()
  @IsNumber()
  week?: number;

  @ApiPropertyOptional({ description: 'Filter by registration ID' })
  @IsOptional()
  @IsMongoId()
  registrationId?: string;
}

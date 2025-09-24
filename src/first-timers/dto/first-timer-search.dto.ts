import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchDto } from '../../common/dto/search.dto';
import { EngagementStatus } from '../../common/enums/engagement-status.enum';

export class FirstTimerSearchDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by engagement status',
    enum: EngagementStatus,
  })
  @IsOptional()
  @IsEnum(EngagementStatus)
  status?: EngagementStatus;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filter from visit date' })
  @IsOptional()
  @IsDateString()
  visitDateFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter to visit date' })
  @IsOptional()
  @IsDateString()
  visitDateTo?: Date;

  @ApiPropertyOptional({ description: 'Filter by conversion status' })
  @IsOptional()
  @IsBoolean()
  converted?: boolean;

  @ApiPropertyOptional({ description: 'Filter visitors needing follow-up' })
  @IsOptional()
  @IsBoolean()
  needsFollowUp?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by visitor type',
    enum: ['first_time', 'returning', 'new_to_area', 'church_shopping'],
  })
  @IsOptional()
  @IsEnum(['first_time', 'returning', 'new_to_area', 'church_shopping'])
  visitorType?: string;

  @ApiPropertyOptional({
    description: 'Filter by how they heard about church',
    enum: [
      'friend',
      'family',
      'advertisement',
      'online',
      'event',
      'walkby',
      'other',
    ],
  })
  @IsOptional()
  @IsEnum([
    'friend',
    'family',
    'advertisement',
    'online',
    'event',
    'walkby',
    'other',
  ])
  howDidYouHear?: string;
}

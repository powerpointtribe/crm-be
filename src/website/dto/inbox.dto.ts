import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SearchDto } from '../../common/dto/search.dto';
import {
  SubmissionStatus,
  SubscriptionChannel,
  SubscriptionList,
  WebFormType,
} from '../schemas/web-form-submission.schema';

export class SubmissionQueryDto extends SearchDto {
  @ApiPropertyOptional({ enum: WebFormType })
  @IsOptional()
  @IsEnum(WebFormType)
  formType?: WebFormType;

  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @ApiPropertyOptional({ description: 'Branch id' })
  @IsOptional()
  @IsMongoId()
  branch?: string;
}

export class UpdateSubmissionDto {
  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Member id, or null to unassign' })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string | null;
}

export class SubscriptionQueryDto extends SearchDto {
  @ApiPropertyOptional({ enum: SubscriptionList })
  @IsOptional()
  @IsEnum(SubscriptionList)
  list?: SubscriptionList;

  @ApiPropertyOptional({ enum: SubscriptionChannel })
  @IsOptional()
  @IsEnum(SubscriptionChannel)
  channel?: SubscriptionChannel;
}

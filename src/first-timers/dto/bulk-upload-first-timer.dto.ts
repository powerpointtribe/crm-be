import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFirstTimerDto } from './create-first-timer.dto';

export class BulkUploadFirstTimerDto {
  @ApiProperty({
    description: 'First-timers data from CSV',
    type: [CreateFirstTimerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFirstTimerDto)
  firstTimers: CreateFirstTimerDto[];

  @ApiPropertyOptional({
    description:
      'Whether to skip validation errors and continue with valid records',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipErrors?: boolean = false;

  @ApiPropertyOptional({
    description: 'Default assignee for all first-timers in the upload',
  })
  @IsOptional()
  @IsString()
  defaultAssignedTo?: string;
}

export class BulkUploadResultDto {
  @ApiProperty({ description: 'Number of successfully processed records' })
  successCount: number;

  @ApiProperty({ description: 'Number of failed records' })
  errorCount: number;

  @ApiProperty({ description: 'Total number of records in upload' })
  totalCount: number;

  @ApiProperty({ description: 'Successfully created first-timers' })
  successfulRecords: any[];

  @ApiProperty({ description: 'Failed records with error details' })
  failedRecords: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;

  @ApiProperty({ description: 'Processing summary message' })
  message: string;
}

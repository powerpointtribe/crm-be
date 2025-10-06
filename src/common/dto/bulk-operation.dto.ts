import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BulkOperationType,
  BulkOperationResult,
} from '../interfaces/bulk-operation.interface';

export class BulkOperationDto {
  @ApiPropertyOptional({
    description:
      'Whether to skip validation errors and continue with valid records',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipErrors?: boolean = false;

  @ApiProperty({
    description: 'Type of bulk operation to perform',
    enum: BulkOperationType,
  })
  @IsEnum(BulkOperationType)
  operationType: BulkOperationType;

  @ApiPropertyOptional({
    description:
      'Field to use as identifier for update operations (e.g., email, phone, _id)',
    default: 'email',
  })
  @IsOptional()
  @IsString()
  identifierField?: string = 'email';

  @ApiPropertyOptional({
    description:
      'Whether to perform a dry run (preview changes without applying them)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;
}

export class GenericBulkResultDto<T = any> implements BulkOperationResult<T> {
  @ApiProperty({ description: 'Number of successfully processed records' })
  successCount: number;

  @ApiProperty({ description: 'Number of failed records' })
  errorCount: number;

  @ApiProperty({ description: 'Total number of records in upload' })
  totalCount: number;

  @ApiProperty({ description: 'Successfully processed records' })
  successfulRecords: T[];

  @ApiProperty({ description: 'Failed records with error details' })
  failedRecords: Array<{
    row: number;
    data: any;
    errors: string[];
    operation?: BulkOperationType;
  }>;

  @ApiProperty({ description: 'Processing summary message' })
  message: string;

  @ApiProperty({
    description: 'Type of operation performed',
    enum: BulkOperationType,
  })
  operationType: BulkOperationType;
}

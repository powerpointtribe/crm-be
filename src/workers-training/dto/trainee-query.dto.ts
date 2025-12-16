import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  WorkersTrainingStatus,
  TrainingOutcome,
} from '../../common/enums/workers-training.enum';

export class TraineeQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'enrollmentDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'enrollmentDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Search term for member name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by cohort ID',
  })
  @IsOptional()
  @IsMongoId()
  cohort?: string;

  @ApiPropertyOptional({
    description: 'Filter by training status',
    enum: WorkersTrainingStatus,
  })
  @IsOptional()
  @IsEnum(WorkersTrainingStatus)
  status?: WorkersTrainingStatus;

  @ApiPropertyOptional({
    description: 'Filter by training outcome',
    enum: TrainingOutcome,
  })
  @IsOptional()
  @IsEnum(TrainingOutcome)
  outcome?: TrainingOutcome;

  @ApiPropertyOptional({
    description: 'Filter by assigned mentor ID',
  })
  @IsOptional()
  @IsMongoId()
  assignedMentor?: string;

  @ApiPropertyOptional({
    description: 'Filter by supervisor ID',
  })
  @IsOptional()
  @IsMongoId()
  supervisor?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned unit ID',
  })
  @IsOptional()
  @IsMongoId()
  assignedUnit?: string;

  @ApiPropertyOptional({
    description: 'Filter by assigned district ID',
  })
  @IsOptional()
  @IsMongoId()
  assignedDistrict?: string;
}
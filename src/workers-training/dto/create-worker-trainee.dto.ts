import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkersTrainingStatus } from '../../common/enums/workers-training.enum';

export class CreateWorkerTraineeDto {
  @IsMongoId()
  member: string;

  @IsMongoId()
  cohort: string;

  @IsOptional()
  @IsEnum(WorkersTrainingStatus)
  status?: WorkersTrainingStatus;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  enrollmentDate?: Date;

  @IsOptional()
  @IsMongoId()
  assignedMentor?: string;

  @IsOptional()
  @IsMongoId()
  supervisor?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  dietaryRestrictions?: string;

  @IsOptional()
  @IsBoolean()
  hasTransportation?: boolean;

  @IsOptional()
  @IsBoolean()
  needsAccommodation?: boolean;

  @IsOptional()
  @IsString()
  accommodationDetails?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

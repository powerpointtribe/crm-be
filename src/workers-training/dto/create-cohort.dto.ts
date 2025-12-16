import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  CohortType,
  CohortStatus,
} from '../../common/enums/workers-training.enum';

class ModuleDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  duration: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsMongoId()
  facilitator?: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean = false;
}

class AssignmentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => new Date(value))
  @IsDate()
  dueDate: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number = 100;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number = 1;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = true;
}

class AddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string = 'Nigeria';
}

export class CreateCohortDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(CohortType)
  type: CohortType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CohortStatus)
  status?: CohortStatus;

  @Transform(({ value }) => new Date(value))
  @IsDate()
  startDate: Date;

  @Transform(({ value }) => new Date(value))
  @IsDate()
  endDate: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  registrationStartDate?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  registrationEndDate?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxParticipants?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minimumAttendance?: number = 80;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingGrade?: number = 70;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  facilitators?: string[];

  @IsOptional()
  @IsMongoId()
  coordinator?: string;

  @IsOptional()
  @IsMongoId()
  supervisor?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsString()
  meetingDays?: string;

  @IsOptional()
  @IsString()
  meetingTime?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleDto)
  modules?: ModuleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentDto)
  assignments?: AssignmentDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisites?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedOutcomes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  currency?: string = 'NGN';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

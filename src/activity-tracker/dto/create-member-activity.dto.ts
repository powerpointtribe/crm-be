import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsMongoId,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  TransitionFrom,
  TransitionTo,
  TravelStatus,
} from '../../common/enums/activity-tracker.enum';

class ImpactAssessmentDto {
  @IsOptional()
  @IsString()
  membershipStatus?: string;

  @IsOptional()
  @IsNumber()
  leadershipLevel?: number;

  @IsOptional()
  @IsNumber()
  engagementScore?: number;

  @IsOptional()
  @IsNumber()
  attendanceImpact?: number;

  @IsOptional()
  @IsNumber()
  ministryInvolvement?: number;
}

export class CreateMemberActivityDto {
  @IsMongoId()
  member: string;

  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @IsEnum(ActivityPriority)
  priority?: ActivityPriority;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  activityDate?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  effectiveDate?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  expiryDate?: Date;

  // Role transitions
  @IsOptional()
  @IsEnum(TransitionFrom)
  fromRole?: TransitionFrom;

  @IsOptional()
  @IsEnum(TransitionTo)
  toRole?: TransitionTo;

  @IsOptional()
  @IsString()
  previousPosition?: string;

  @IsOptional()
  @IsString()
  newPosition?: string;

  // Unit/Group movements
  @IsOptional()
  @IsMongoId()
  fromUnit?: string;

  @IsOptional()
  @IsMongoId()
  toUnit?: string;

  @IsOptional()
  @IsMongoId()
  fromDistrict?: string;

  @IsOptional()
  @IsMongoId()
  toDistrict?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  fromMinistries?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  toMinistries?: string[];

  // Travel and location
  @IsOptional()
  @IsEnum(TravelStatus)
  travelStatus?: TravelStatus;

  @IsOptional()
  @IsString()
  previousLocation?: string;

  @IsOptional()
  @IsString()
  newLocation?: string;

  @IsOptional()
  @IsString()
  travelReason?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  expectedReturnDate?: Date;

  @IsOptional()
  @IsString()
  contactInformation?: string;

  @IsOptional()
  @IsBoolean()
  isTemporary?: boolean;

  // Training related
  @IsOptional()
  @IsMongoId()
  relatedCohort?: string;

  @IsOptional()
  @IsMongoId()
  relatedTraining?: string;

  @IsOptional()
  @IsString()
  trainingOutcome?: string;

  @IsOptional()
  @IsString()
  certification?: string;

  // Change tracking
  @IsOptional()
  @IsObject()
  previousValues?: Record<string, any>;

  @IsOptional()
  @IsObject()
  newValues?: Record<string, any>;

  // Administrative
  @IsOptional()
  @IsMongoId()
  approvedBy?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  approvalDate?: Date;

  @IsOptional()
  @IsString()
  approvalNotes?: string;

  @IsOptional()
  @IsMongoId()
  supervisedBy?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportingDocuments?: string[];

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  nextFollowUpDate?: Date;

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImpactAssessmentDto)
  impactAssessment?: ImpactAssessmentDto;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  relatedActivities?: string[];

  @IsOptional()
  @IsMongoId()
  parentActivity?: string;

  @IsOptional()
  @IsBoolean()
  isSystemGenerated?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

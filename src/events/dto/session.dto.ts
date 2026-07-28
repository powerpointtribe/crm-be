import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SessionType, SessionStatus } from '../schemas/event-session.schema';
import { SessionAttendanceStatus } from '../schemas/session-attendance.schema';

// Learning Objective DTO
class LearningObjectiveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

// Session Resource DTO
class SessionResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ enum: ['document', 'video', 'link', 'presentation', 'other'] })
  @IsEnum(['document', 'video', 'link', 'presentation', 'other'])
  type: 'document' | 'video' | 'link' | 'presentation' | 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

// Session Facilitator DTO
class SessionFacilitatorDto {
  @ApiProperty()
  @IsMongoId()
  member: string;

  @ApiProperty({ enum: ['lead', 'assistant', 'guest'], default: 'lead' })
  @IsEnum(['lead', 'assistant', 'guest'])
  role: 'lead' | 'assistant' | 'guest';
}

// Session Location DTO
class SessionLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  virtualLink?: string;
}

// Assessment Configuration DTO
class AssessmentConfigDto {
  @ApiProperty({ default: false })
  @IsBoolean()
  hasAssessment: boolean;

  @ApiPropertyOptional({ enum: ['quiz', 'assignment', 'practical', 'presentation'] })
  @IsOptional()
  @IsEnum(['quiz', 'assignment', 'practical', 'presentation'])
  assessmentType?: 'quiz' | 'assignment' | 'practical' | 'presentation';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

// Attendance Config DTO
class AttendanceConfigDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowLateArrival?: boolean;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lateArrivalThresholdMinutes?: number;
}

// Create Session DTO
export class CreateSessionDto {
  @ApiProperty()
  @IsMongoId()
  event: string;

  // Optional module this session belongs to (surfaces "Join live" in-module).
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SessionType, default: SessionType.LECTURE })
  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  startTime: string;

  @ApiProperty()
  @IsString()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ type: SessionLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionLocationDto)
  location?: SessionLocationDto;

  @ApiPropertyOptional({ type: [SessionFacilitatorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionFacilitatorDto)
  facilitators?: SessionFacilitatorDto[];

  @ApiPropertyOptional({ type: [LearningObjectiveDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningObjectiveDto)
  learningObjectives?: LearningObjectiveDto[];

  @ApiPropertyOptional({ type: [SessionResourceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionResourceDto)
  resources?: SessionResourceDto[];

  @ApiPropertyOptional({ type: AssessmentConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssessmentConfigDto)
  assessment?: AssessmentConfigDto;

  @ApiPropertyOptional({ type: AttendanceConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceConfigDto)
  attendanceConfig?: AttendanceConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Zoom meeting/webinar ID for this session' })
  @IsOptional()
  @IsString()
  zoomMeetingId?: string;

  @ApiPropertyOptional({ enum: ['meeting', 'webinar'] })
  @IsOptional()
  @IsIn(['meeting', 'webinar'])
  zoomType?: 'meeting' | 'webinar';

  @ApiPropertyOptional({ description: 'Zoom meeting passcode (for embedded join)' })
  @IsOptional()
  @IsString()
  zoomPasscode?: string;
}

// Update Session DTO
export class UpdateSessionDto extends PartialType(CreateSessionDto) {
  @ApiPropertyOptional({ enum: SessionStatus })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}

// Record Session Attendance DTO
export class RecordSessionAttendanceDto {
  @ApiProperty()
  @IsMongoId()
  registrationId: string;

  @ApiProperty({ enum: SessionAttendanceStatus })
  @IsEnum(SessionAttendanceStatus)
  status: SessionAttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkInTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lateByMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilitatorNotes?: string;
}

// Bulk Record Attendance DTO
export class BulkRecordAttendanceDto {
  @ApiProperty({ type: [RecordSessionAttendanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordSessionAttendanceDto)
  attendances: RecordSessionAttendanceDto[];
}

// Record Assessment Result DTO
export class RecordAssessmentResultDto {
  @ApiProperty()
  @IsMongoId()
  registrationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  score: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  maxScore: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  attemptNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;
}

// Update Objective Completion DTO
export class UpdateObjectiveCompletionDto {
  @ApiProperty()
  @IsMongoId()
  registrationId: string;

  @ApiProperty()
  @IsString()
  objectiveId: string;

  @ApiProperty()
  @IsBoolean()
  completed: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Session Search/Filter DTO
export class SessionSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  event?: string;

  @ApiPropertyOptional({ enum: SessionType })
  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @ApiPropertyOptional({ enum: SessionStatus })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  facilitator?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

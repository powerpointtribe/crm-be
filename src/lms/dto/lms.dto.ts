import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;
}

export class UpdateModuleDto extends CreateModuleDto {
  @IsOptional()
  @IsString()
  declare title: string;
}

export class ResourceDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() type: string;
  @IsString() @IsNotEmpty() url: string;
}

export class CreateLessonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ type: [ResourceDto] })
  @IsOptional()
  @IsArray()
  resources?: ResourceDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reflectionPrompt?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;
}

export class UpdateLessonDto extends CreateLessonDto {
  @IsOptional()
  @IsString()
  declare title: string;
}

export class QuizQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    enum: [
      'multiple_choice',
      'dropdown',
      'checkboxes',
      'short_text',
      'long_text',
      'date',
      'file',
    ],
  })
  @IsOptional()
  @IsIn([
    'multiple_choice',
    'dropdown',
    'checkboxes',
    'short_text',
    'long_text',
    'date',
    'file',
  ])
  type?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  correctIndex?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  correctIndexes?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  points?: number;
}

export class UpsertQuizDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  passingScore?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions: QuizQuestionDto[];
}

export class SubmitQuizDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;

  // One response per question; type depends on the question (index/array/string).
  @ApiProperty({ type: [Object] })
  @IsArray()
  responses: any[];
}

export class CreateAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lesson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;
}

export class UpdateAssignmentDto extends CreateAssignmentDto {
  @IsOptional()
  @IsString()
  declare title: string;
}

export class SubmitAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class GradeSubmissionDto {
  @ApiProperty()
  @IsNumber()
  grade: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class GenerateCourseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  moduleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApplyCourseDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  modules: any[];
}

export class AssistantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lessonId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  history?: any[];
}

export class ReorderDto {
  @ApiProperty({ type: [String], description: 'Ids in their new order' })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

export class SetLessonProgressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class SaveReflectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventSlug?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @ApiProperty()
  @IsString()
  content: string;
}

export class SessionHeartbeatDto {
  // Seconds watched since the previous heartbeat. Server-capped as an
  // anti-spoof measure — see LmsService.MAX_HEARTBEAT_SECONDS.
  @ApiPropertyOptional({ description: 'Seconds watched since last heartbeat.' })
  @IsOptional()
  @IsNumber()
  seconds?: number;

  // Sent true on the first heartbeat of a fresh viewing session (player mount),
  // so the server can increment the view count.
  @ApiPropertyOptional({ description: 'First beat of a new viewing session.' })
  @IsOptional()
  @IsBoolean()
  newView?: boolean;
}

export class PublishRecordingDto {
  @ApiProperty({ description: 'Module to publish the recording lesson under.' })
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @ApiPropertyOptional({ description: 'Optional lesson title override.' })
  @IsOptional()
  @IsString()
  title?: string;
}

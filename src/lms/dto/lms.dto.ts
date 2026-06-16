import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
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

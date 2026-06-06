import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsArray,
  IsEnum,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateCategory, TemplateModule, AVAILABLE_TEMPLATE_VARIABLES } from '../schemas/email-template.schema';

export class VariableDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sampleValue?: string;
}

export class CreateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Campus ID (auto-assigned from user if not provided)' })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value === '' ? undefined : value))
  branch?: string;

  @ApiProperty({ description: 'Template name', example: 'Weekly Newsletter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Email subject line', example: 'This Week at Church' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'HTML content of the email' })
  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @ApiPropertyOptional({ description: 'Plain text version of the email' })
  @IsOptional()
  @IsString()
  plainTextContent?: string;

  @ApiPropertyOptional({
    description: 'Available template variables',
    example: ['firstName', 'lastName', 'email'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableVariables?: string[];

  @ApiPropertyOptional({
    description: 'Template category',
    enum: TemplateCategory,
    default: TemplateCategory.GENERAL,
  })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({
    description: 'Module this template belongs to',
    enum: TemplateModule,
  })
  @IsOptional()
  @IsEnum(TemplateModule)
  module?: TemplateModule;

  @ApiPropertyOptional({
    description: 'Programmatic slug (e.g. members.birthday-wishes)',
    example: 'members.birthday-wishes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Variable definitions for template placeholders',
    type: [VariableDefinitionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableDefinitionDto)
  variableDefinitions?: VariableDefinitionDto[];

  @ApiPropertyOptional({ description: 'Is template active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML content of the email' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ description: 'Plain text version of the email' })
  @IsOptional()
  @IsString()
  plainTextContent?: string;

  @ApiPropertyOptional({ description: 'Available template variables' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableVariables?: string[];

  @ApiPropertyOptional({ description: 'Template category', enum: TemplateCategory })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({
    description: 'Module this template belongs to',
    enum: TemplateModule,
  })
  @IsOptional()
  @IsEnum(TemplateModule)
  module?: TemplateModule;

  @ApiPropertyOptional({ description: 'Programmatic slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Variable definitions for template placeholders',
    type: [VariableDefinitionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableDefinitionDto)
  variableDefinitions?: VariableDefinitionDto[];

  @ApiPropertyOptional({ description: 'Is template active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

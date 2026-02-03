import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsArray,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TemplateCategory, AVAILABLE_TEMPLATE_VARIABLES } from '../schemas/email-template.schema';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsNotEmpty({ message: 'Branch is required' })
  @IsMongoId()
  branch: string;

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

  @ApiPropertyOptional({ description: 'Is template active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsArray,
  IsEnum,
  IsNumber,
  MaxLength,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormFieldType, FormTheme, FormModule } from '../schemas/form-template.schema';

export class FormFieldOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class FormFieldValidationDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minLength?: number;

  @IsOptional()
  @IsNumber()
  @Max(10000)
  maxLength?: number;

  @IsOptional()
  @IsString()
  pattern?: string;
}

export class FormFieldDto {
  @ApiProperty({ description: 'Unique field key', example: 'fullName' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Field type', enum: FormFieldType })
  @IsEnum(FormFieldType)
  type: FormFieldType;

  @ApiProperty({ description: 'Field label', example: 'Full Name' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Is field required', default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Field width', enum: ['full', 'half'] })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ description: 'Options for select/radio/checkbox', type: [FormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @ApiPropertyOptional({ description: 'Validation rules' })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormFieldValidationDto)
  validation?: FormFieldValidationDto;

  @ApiPropertyOptional({ description: 'Help text shown below field' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ description: 'Default value' })
  @IsOptional()
  @IsString()
  defaultValue?: string;
}

export class FormStyleDto {
  @ApiPropertyOptional({ description: 'Theme', enum: FormTheme })
  @IsOptional()
  @IsEnum(FormTheme)
  theme?: FormTheme;

  @ApiPropertyOptional({ description: 'Primary/accent color' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Background color' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Text color' })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ description: 'Card/surface color' })
  @IsOptional()
  @IsString()
  cardColor?: string;

  @ApiPropertyOptional({ description: 'Body font family' })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional({ description: 'Heading font family' })
  @IsOptional()
  @IsString()
  headingFontFamily?: string;
}

export class CreateFormTemplateDto {
  @ApiPropertyOptional({ description: 'Branch ID (auto-assigned from user if not provided)' })
  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (value === '' ? undefined : value))
  branch?: string;

  @ApiProperty({ description: 'Form name', example: 'Event Feedback Form' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Programmatic slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Form description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Module', enum: FormModule })
  @IsOptional()
  @IsEnum(FormModule)
  module?: FormModule;

  @ApiPropertyOptional({
    description: 'Form fields (structured mode)',
    type: [FormFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiPropertyOptional({ description: 'HTML content (HTML mode)' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({
    description: 'Form styling',
    type: FormStyleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormStyleDto)
  style?: FormStyleDto;

  @ApiPropertyOptional({ description: 'Submit button text', default: 'Submit' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submitButtonText?: string;

  @ApiPropertyOptional({ description: 'Success message after submission' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  successMessage?: string;

  @ApiPropertyOptional({ description: 'Success heading after submission' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  successHeading?: string;

  @ApiPropertyOptional({ description: 'Allow anonymous submissions', default: false })
  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @ApiPropertyOptional({
    description: 'Thumbnail image URL for social sharing',
  })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Is form active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFormTemplateDto {
  @ApiPropertyOptional({ description: 'Form name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Programmatic slug' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Form description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Module', enum: FormModule })
  @IsOptional()
  @IsEnum(FormModule)
  module?: FormModule;

  @ApiPropertyOptional({
    description: 'Form fields (structured mode)',
    type: [FormFieldDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];

  @ApiPropertyOptional({ description: 'HTML content (HTML mode)' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({
    description: 'Form styling',
    type: FormStyleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormStyleDto)
  style?: FormStyleDto;

  @ApiPropertyOptional({ description: 'Submit button text' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  submitButtonText?: string;

  @ApiPropertyOptional({ description: 'Success message' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  successMessage?: string;

  @ApiPropertyOptional({ description: 'Success heading' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  successHeading?: string;

  @ApiPropertyOptional({ description: 'Allow anonymous submissions' })
  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @ApiPropertyOptional({
    description: 'Thumbnail image URL for social sharing',
  })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Is form active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

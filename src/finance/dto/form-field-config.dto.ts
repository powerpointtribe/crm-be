import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { FormFieldType } from '../schemas/form-field-config.schema';

// DTO for select options
export class SelectOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

// DTO for field validation
export class FieldValidationDto {
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  minLength?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxLength?: number;

  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  max?: number;

  @IsString()
  @IsOptional()
  pattern?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  patternMessage?: string;
}

// Create form field config DTO
export class CreateFormFieldConfigDto {
  @IsString()
  @IsNotEmpty()
  formType: string;

  @IsString()
  @IsNotEmpty()
  fieldKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  placeholder?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  helpText?: string;

  @IsEnum(FormFieldType)
  @IsNotEmpty()
  fieldType: FormFieldType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectOptionDto)
  @IsOptional()
  options?: SelectOptionDto[];

  @ValidateNested()
  @Type(() => FieldValidationDto)
  @IsOptional()
  validation?: FieldValidationDto;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(2)
  step: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(12)
  gridSpan?: number;
}

// Update form field config DTO
export class UpdateFormFieldConfigDto extends PartialType(
  CreateFormFieldConfigDto,
) {}

// Bulk update sort order DTO
export class BulkUpdateSortOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortOrderItemDto)
  items: SortOrderItemDto[];
}

export class SortOrderItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  @Min(0)
  sortOrder: number;
}

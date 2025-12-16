import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsMongoId()
  @IsOptional()
  parentRole?: string;

  @IsNumber()
  @IsOptional()
  level?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  colorCode?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

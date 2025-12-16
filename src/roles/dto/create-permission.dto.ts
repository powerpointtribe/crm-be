import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EndpointDto {
  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  method?: string;
}

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  module: string;

  @IsString()
  @IsNotEmpty()
  resource: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @ValidateNested()
  @Type(() => EndpointDto)
  @IsOptional()
  endpoint?: EndpointDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

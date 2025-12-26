import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsMongoId,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction, AuditEntity } from '../../common/enums/audit-action.enum';

class MetadataDto {
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
}

export class CreateAuditLogDto {
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsEnum(AuditEntity)
  entityType: AuditEntity;

  @IsString()
  entityId: string;

  @IsMongoId()
  performedBy: string;

  @IsString()
  performedByName: string;

  @IsString()
  performedByEmail: string;

  @IsArray()
  @IsString({ each: true })
  performedByRoles: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  oldValues?: Record<string, any>;

  @IsOptional()
  @IsObject()
  newValues?: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @IsOptional()
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsBoolean()
  isSystemGenerated?: boolean;

  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsMongoId()
  relatedUnit?: string;

  @IsOptional()
  @IsMongoId()
  relatedDistrict?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

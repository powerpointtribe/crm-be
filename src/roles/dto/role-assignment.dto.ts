import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScopeType } from '../schemas/role-assignment.schema';

export class CreateRoleAssignmentDto {
  @ApiProperty({ description: 'Member ID to assign role to' })
  @IsMongoId()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ description: 'Role ID to assign' })
  @IsMongoId()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({
    description: 'Scope type for the assignment',
    enum: ScopeType,
    default: ScopeType.GLOBAL,
  })
  @IsEnum(ScopeType)
  @IsNotEmpty()
  scopeType: ScopeType;

  @ApiPropertyOptional({
    description: 'Entity ID for the scope (required unless scopeType is global)',
  })
  @ValidateIf((o) => o.scopeType !== ScopeType.GLOBAL)
  @IsMongoId()
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Additional scope IDs for multi-entity access (e.g., multiple districts)',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  additionalScopeIds?: string[];

  @ApiPropertyOptional({ description: 'Whether this is the primary role assignment' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Expiration date for temporary assignments' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Admin notes about the assignment' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateRoleAssignmentDto {
  @ApiPropertyOptional({ description: 'Whether the assignment is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether this is the primary role assignment' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: 'Additional scope IDs for multi-entity access',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  additionalScopeIds?: string[];

  @ApiPropertyOptional({ description: 'Expiration date for temporary assignments' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Admin notes about the assignment' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class RoleAssignmentQueryDto {
  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter by role ID' })
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Filter by scope type', enum: ScopeType })
  @IsOptional()
  @IsEnum(ScopeType)
  scopeType?: ScopeType;

  @ApiPropertyOptional({ description: 'Filter by scope entity ID' })
  @IsOptional()
  @IsMongoId()
  scopeId?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by primary status' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Include expired assignments' })
  @IsOptional()
  @IsBoolean()
  includeExpired?: boolean;
}

export class BulkRoleAssignmentDto {
  @ApiProperty({ description: 'Array of member IDs to assign role to' })
  @IsArray()
  @IsMongoId({ each: true })
  memberIds: string[];

  @ApiProperty({ description: 'Role ID to assign' })
  @IsMongoId()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({ description: 'Scope type for the assignment', enum: ScopeType })
  @IsEnum(ScopeType)
  @IsNotEmpty()
  scopeType: ScopeType;

  @ApiPropertyOptional({ description: 'Entity ID for the scope' })
  @ValidateIf((o) => o.scopeType !== ScopeType.GLOBAL)
  @IsMongoId()
  scopeId?: string;
}

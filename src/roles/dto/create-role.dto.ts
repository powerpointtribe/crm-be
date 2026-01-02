import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  IsEnum,
} from 'class-validator';
import { MembershipStatus } from '../../common/enums/member-status.enum';

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modules?: string[]; // Selected modules - auto-grants VIEW permissions for each module

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

  @IsEnum(MembershipStatus)
  @IsOptional()
  membershipStatusTag?: MembershipStatus;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

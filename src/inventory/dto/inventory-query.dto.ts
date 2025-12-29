import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  Min,
  IsMongoId,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InventoryStatus,
  UnitOfMeasurement,
} from '../../common/enums/inventory.enum';

export class InventoryQueryDto {
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsMongoId()
  category?: string;

  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @IsEnum(UnitOfMeasurement)
  unitOfMeasurement?: UnitOfMeasurement;

  @IsOptional()
  @IsMongoId()
  assignedUnit?: string;

  @IsOptional()
  @IsMongoId()
  assignedDistrict?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  outOfStock?: boolean;

  @IsOptional()
  @IsBoolean()
  nearExpiry?: boolean;

  @IsOptional()
  @IsDateString()
  expiryDateStart?: string;

  @IsOptional()
  @IsDateString()
  expiryDateEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

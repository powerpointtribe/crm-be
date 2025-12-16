import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsMongoId,
  IsArray,
  IsObject,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InventoryStatus,
  UnitOfMeasurement,
} from '../../common/enums/inventory.enum';

class DimensionsDto {
  @IsNumber()
  @Min(0)
  length: number;

  @IsNumber()
  @Min(0)
  width: number;

  @IsNumber()
  @Min(0)
  height: number;

  @IsEnum(['cm', 'in', 'm'])
  unit: string;
}

class TrackingDto {
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @IsOptional()
  @IsEnum(['individual', 'batch', 'bulk'])
  trackingType?: string;

  @IsOptional()
  @IsArray()
  individualItems?: Array<{
    serialNumber: string;
    status: string;
    assignedTo?: string;
    assignmentDate?: Date;
    condition?: string;
    lastMaintenanceDate?: Date;
    notes?: string;
  }>;

  @IsOptional()
  @IsObject()
  batchInfo?: {
    batchNumber: string;
    manufactureDate: Date;
    expiryDate: Date;
    quantity: number;
  };
}

export class CreateInventoryItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsMongoId()
  category: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsEnum(UnitOfMeasurement)
  unitOfMeasurement: UnitOfMeasurement;

  @IsNumber()
  @Min(0)
  currentStock: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

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
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  supplierContact?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TrackingDto)
  tracking?: TrackingDto;

  @IsOptional()
  @IsBoolean()
  isDepreciable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depreciationRate?: number;
}

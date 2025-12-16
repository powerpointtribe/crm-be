import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsMongoId,
  IsDateString,
  IsArray,
  IsObject,
} from 'class-validator';
import { InventoryMovementType } from '../../common/enums/inventory.enum';

export class CreateInventoryMovementDto {
  @IsMongoId()
  inventoryItem: string;

  @IsEnum(InventoryMovementType)
  movementType: InventoryMovementType;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsMongoId()
  fromUnit?: string;

  @IsOptional()
  @IsMongoId()
  toUnit?: string;

  @IsOptional()
  @IsMongoId()
  fromDistrict?: string;

  @IsOptional()
  @IsMongoId()
  toDistrict?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  supplierInvoiceDate?: string;

  @IsOptional()
  @IsMongoId()
  receivedBy?: string;

  @IsOptional()
  @IsMongoId()
  approvedBy?: string;

  @IsOptional()
  @IsDateString()
  approvedDate?: string;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsObject()
  metadata?: {
    location?: string;
    weather?: string;
    temperature?: number;
    damageDetails?: string;
    returnReason?: string;
  };

  @IsOptional()
  @IsDateString()
  movementDate?: string;
}

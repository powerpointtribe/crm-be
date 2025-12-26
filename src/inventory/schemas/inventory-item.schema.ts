import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  InventoryStatus,
  UnitOfMeasurement,
} from '../../common/enums/inventory.enum';

export type InventoryItemDocument = InventoryItem &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'inventory_items',
})
export class InventoryItem {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, unique: true, required: true })
  itemCode: string;

  @Prop({ type: String, unique: true })
  barcode?: string;

  @Prop({ type: Types.ObjectId, ref: 'InventoryCategory', required: true })
  category: Types.ObjectId;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: String })
  model?: string;

  @Prop({ type: String })
  serialNumber?: string;

  @Prop({
    type: String,
    enum: Object.values(UnitOfMeasurement),
    required: true,
  })
  unitOfMeasurement: UnitOfMeasurement;

  @Prop({ type: Number, required: true, min: 0 })
  currentStock: number;

  @Prop({ type: Number, default: 0, min: 0 })
  minimumStock: number;

  @Prop({ type: Number, default: 0, min: 0 })
  maximumStock: number;

  @Prop({ type: Number, default: 0, min: 0 })
  reorderLevel: number;

  @Prop({ type: Number, default: 0, min: 0 })
  unitCost: number;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(InventoryStatus),
    default: InventoryStatus.ACTIVE,
  })
  status: InventoryStatus;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  assignedUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  assignedDistrict?: Types.ObjectId;

  @Prop({ type: String })
  location?: string;

  @Prop({ type: String })
  supplier?: string;

  @Prop({ type: String })
  supplierContact?: string;

  @Prop({ type: Date })
  purchaseDate?: Date;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ type: Date })
  warrantyExpiry?: Date;

  @Prop({ type: Number })
  weight?: number;

  @Prop({
    type: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, enum: ['cm', 'in', 'm'] },
    },
  })
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };

  @Prop([String])
  imageUrls?: string[];

  @Prop([String])
  documentUrls?: string[];

  @Prop({ type: Object })
  customFields?: Record<string, any>;

  @Prop([String])
  tags?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({
    type: {
      isTracked: { type: Boolean, default: true },
      trackingType: {
        type: String,
        enum: ['individual', 'batch', 'bulk'],
        default: 'bulk',
      },
      individualItems: [
        {
          serialNumber: String,
          status: {
            type: String,
            enum: ['available', 'assigned', 'damaged', 'lost'],
          },
          assignedTo: { type: Types.ObjectId, ref: 'Member' },
          assignmentDate: Date,
          condition: String,
          lastMaintenanceDate: Date,
          notes: String,
        },
      ],
      batchInfo: {
        batchNumber: String,
        manufactureDate: Date,
        expiryDate: Date,
        quantity: Number,
      },
    },
    default: {
      isTracked: true,
      trackingType: 'bulk',
    },
  })
  tracking: {
    isTracked: boolean;
    trackingType: string;
    individualItems?: Array<{
      serialNumber: string;
      status: string;
      assignedTo?: Types.ObjectId;
      assignmentDate?: Date;
      condition?: string;
      lastMaintenanceDate?: Date;
      notes?: string;
    }>;
    batchInfo?: {
      batchNumber: string;
      manufactureDate: Date;
      expiryDate: Date;
      quantity: number;
    };
  };

  @Prop({ type: Boolean, default: false })
  isDepreciable: boolean;

  @Prop({ type: Number })
  depreciationRate?: number;

  @Prop({ type: Date })
  lastStockCheck?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  lastStockCheckedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);

// Virtual for stock status
InventoryItemSchema.virtual('stockStatus').get(function () {
  if (this.currentStock <= 0) return 'OUT_OF_STOCK';
  if (this.currentStock <= this.reorderLevel) return 'LOW_STOCK';
  if (this.currentStock >= this.maximumStock) return 'OVERSTOCK';
  return 'IN_STOCK';
});

// Virtual for total value
InventoryItemSchema.virtual('totalValue').get(function () {
  return this.currentStock * this.unitCost;
});

// Indexes
InventoryItemSchema.index({ itemCode: 1 });
InventoryItemSchema.index({ barcode: 1 });
InventoryItemSchema.index({ name: 1 });
InventoryItemSchema.index({ category: 1 });
InventoryItemSchema.index({ status: 1 });
InventoryItemSchema.index({ assignedUnit: 1 });
InventoryItemSchema.index({ assignedDistrict: 1 });
InventoryItemSchema.index({ currentStock: 1 });
InventoryItemSchema.index({ reorderLevel: 1 });
InventoryItemSchema.index({ expiryDate: 1 });
InventoryItemSchema.index({ lastStockCheck: 1 });

// Compound indexes for common queries
InventoryItemSchema.index({ category: 1, status: 1 });
InventoryItemSchema.index({ assignedUnit: 1, status: 1 });
InventoryItemSchema.index({ currentStock: 1, reorderLevel: 1 });

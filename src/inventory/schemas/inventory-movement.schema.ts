import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InventoryMovementType } from '../../common/enums/inventory.enum';

export type InventoryMovementDocument = InventoryMovement &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'inventory_movements',
})
export class InventoryMovement {
  @Prop({ type: Types.ObjectId, ref: 'InventoryItem', required: true })
  inventoryItem: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(InventoryMovementType),
    required: true,
  })
  movementType: InventoryMovementType;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number })
  unitCost?: number;

  @Prop({ type: Number })
  totalCost?: number;

  @Prop({ type: Number, required: true })
  previousStock: number;

  @Prop({ type: Number, required: true })
  newStock: number;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: String })
  referenceNumber?: string;

  @Prop({ type: String })
  batchNumber?: string;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  fromUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  toUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  fromDistrict?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  toDistrict?: Types.ObjectId;

  @Prop({ type: String })
  supplier?: string;

  @Prop({ type: String })
  supplierInvoiceNumber?: string;

  @Prop({ type: Date })
  supplierInvoiceDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  receivedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedDate?: Date;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved',
  })
  status: string;

  @Prop({ type: String })
  notes?: string;

  @Prop([String])
  attachments?: string[];

  @Prop({ type: Object })
  metadata?: {
    location?: string;
    weather?: string;
    temperature?: number;
    damageDetails?: string;
    returnReason?: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  performedBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  movementDate: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const InventoryMovementSchema =
  SchemaFactory.createForClass(InventoryMovement);

// Indexes for better query performance
InventoryMovementSchema.index({ inventoryItem: 1, movementDate: -1 });
InventoryMovementSchema.index({ movementType: 1, movementDate: -1 });
InventoryMovementSchema.index({ performedBy: 1, movementDate: -1 });
InventoryMovementSchema.index({ fromUnit: 1, movementDate: -1 });
InventoryMovementSchema.index({ toUnit: 1, movementDate: -1 });
InventoryMovementSchema.index({ status: 1, movementDate: -1 });
InventoryMovementSchema.index({ movementDate: -1 });
InventoryMovementSchema.index({ referenceNumber: 1 });

// Compound indexes
InventoryMovementSchema.index({
  inventoryItem: 1,
  movementType: 1,
  movementDate: -1,
});
InventoryMovementSchema.index({ fromUnit: 1, toUnit: 1, movementDate: -1 });

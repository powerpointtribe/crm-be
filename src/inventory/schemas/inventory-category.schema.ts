import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InventoryCategoryType } from '../../common/enums/inventory.enum';

export type InventoryCategoryDocument = InventoryCategory &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'inventory_categories',
})
export class InventoryCategory {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(InventoryCategoryType),
    default: InventoryCategoryType.GENERAL,
  })
  type: InventoryCategoryType;

  @Prop({ type: String, unique: true, required: true })
  code: string;

  @Prop({ type: String })
  color?: string;

  @Prop({ type: String })
  icon?: string;

  @Prop({ type: Types.ObjectId, ref: 'InventoryCategory' })
  parentCategory?: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const InventoryCategorySchema =
  SchemaFactory.createForClass(InventoryCategory);

// Indexes
InventoryCategorySchema.index({ code: 1 });
InventoryCategorySchema.index({ name: 1 });
InventoryCategorySchema.index({ type: 1 });
InventoryCategorySchema.index({ parentCategory: 1 });
InventoryCategorySchema.index({ isActive: 1 });
InventoryCategorySchema.index({ sortOrder: 1 });

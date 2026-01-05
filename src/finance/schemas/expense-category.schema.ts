import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseCategoryDocument = ExpenseCategory &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'expense_categories',
})
export class ExpenseCategory {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, unique: true, sparse: true })
  code?: string;

  @Prop({ type: Number, min: 0 })
  budgetLimit?: number;

  @Prop({ type: Boolean, default: true })
  requiresApproval: boolean;

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

export const ExpenseCategorySchema =
  SchemaFactory.createForClass(ExpenseCategory);

// Indexes
ExpenseCategorySchema.index({ branch: 1, name: 1 }, { unique: true });
ExpenseCategorySchema.index({ code: 1 });
ExpenseCategorySchema.index({ isActive: 1 });
ExpenseCategorySchema.index({ sortOrder: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BulkOperationType } from '../../common/interfaces/bulk-operation.interface';

export type BulkOperationHistoryDocument = BulkOperationHistory & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class BulkOperationHistory {
  @Prop({ required: true, trim: true })
  entityType: string;

  @Prop({
    type: String,
    enum: Object.values(BulkOperationType),
    required: true,
  })
  operation: BulkOperationType;

  @Prop({ required: true, default: 0 })
  totalRecords: number;

  @Prop({ required: true, default: 0 })
  successCount: number;

  @Prop({ required: true, default: 0 })
  errorCount: number;

  @Prop({
    type: String,
    enum: ['completed', 'failed', 'pending'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ trim: true })
  message?: string;

  @Prop([String])
  errors: string[];

  @Prop({ trim: true })
  fileName?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const BulkOperationHistorySchema = SchemaFactory.createForClass(BulkOperationHistory);

// Add indexes for better performance
BulkOperationHistorySchema.index({ entityType: 1 });
BulkOperationHistorySchema.index({ operation: 1 });
BulkOperationHistorySchema.index({ createdBy: 1 });
BulkOperationHistorySchema.index({ status: 1 });
BulkOperationHistorySchema.index({ createdAt: -1 });
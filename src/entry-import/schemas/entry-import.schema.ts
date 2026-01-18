import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EntryImportDocument = EntryImport & Document;

export enum EntryImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
}

export enum EntryImportItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum EntryImportEntityType {
  FIRST_TIMER = 'first_timer',
  MEMBER = 'member',
  MASTER_MEMBER = 'master_member',
  GROUP = 'group',
  BRANCH = 'branch',
  SERVICE_REPORT = 'service_report',
  EXPENSE_CATEGORY = 'expense_category',
  // Add more entity types as needed
}

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'entry_imports',
})
export class EntryImport {
  @Prop({
    type: String,
    enum: Object.values(EntryImportEntityType),
    required: true,
  })
  entityType: EntryImportEntityType;

  @Prop({ required: true, trim: true })
  fileName: string;

  @Prop({ trim: true })
  fileUrl?: string;

  @Prop({ required: true })
  totalRecords: number;

  @Prop({ default: 0 })
  processedRecords: number;

  @Prop({ default: 0 })
  successCount: number;

  @Prop({ default: 0 })
  errorCount: number;

  @Prop({ default: 0 })
  skippedCount: number;

  @Prop({
    type: String,
    enum: Object.values(EntryImportStatus),
    default: EntryImportStatus.PENDING,
  })
  status: EntryImportStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branch?: Types.ObjectId;

  @Prop({ trim: true })
  message?: string;

  @Prop({ type: Object })
  options?: Record<string, any>;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EntryImportSchema = SchemaFactory.createForClass(EntryImport);

// Indexes
EntryImportSchema.index({ entityType: 1 });
EntryImportSchema.index({ status: 1 });
EntryImportSchema.index({ createdBy: 1 });
EntryImportSchema.index({ branch: 1 });
EntryImportSchema.index({ createdAt: -1 });

// Entry Import Item - Individual records within an import
@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'entry_import_items',
})
export class EntryImportItem {
  @Prop({ type: Types.ObjectId, ref: 'EntryImport', required: true, index: true })
  entryImport: Types.ObjectId;

  @Prop({ required: true })
  rowNumber: number;

  @Prop({ type: Object, required: true })
  rawData: Record<string, any>;

  @Prop({ type: Object })
  mappedData?: Record<string, any>;

  @Prop({
    type: String,
    enum: Object.values(EntryImportItemStatus),
    default: EntryImportItemStatus.PENDING,
  })
  status: EntryImportItemStatus;

  @Prop({ type: Types.ObjectId })
  createdEntityId?: Types.ObjectId;

  @Prop([String])
  errors: string[];

  @Prop({ trim: true })
  uniqueKey?: string; // For duplicate checking (e.g., phone for first timers, email for members)

  @Prop({ type: Date })
  processedAt?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export type EntryImportItemDocument = EntryImportItem & Document;
export const EntryImportItemSchema = SchemaFactory.createForClass(EntryImportItem);

// Indexes for EntryImportItem
EntryImportItemSchema.index({ entryImport: 1, status: 1 });
EntryImportItemSchema.index({ entryImport: 1, rowNumber: 1 });
EntryImportItemSchema.index({ uniqueKey: 1 });
EntryImportItemSchema.index({ status: 1 });

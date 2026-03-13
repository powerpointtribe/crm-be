import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Enum for requisition status
// Workflow: DRAFT -> PENDING_APPROVAL -> APPROVED -> DISBURSED -> CLOSED
//                                     -> REJECTED
export enum RequisitionStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISBURSED = 'disbursed',
  CLOSED = 'closed',
}

// Embedded schema for cost breakdown items
export class CostBreakdownItem {
  @Prop({ required: true, trim: true })
  item: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitCost: number;

  @Prop({ required: true, min: 0 })
  total: number;
}

// Embedded schema for bank account details
export class BankAccountDetails {
  @Prop({ required: true, trim: true })
  bankName: string;

  @Prop({ required: true, trim: true })
  accountName: string;

  @Prop({ required: true, trim: true })
  accountNumber: string;
}

export type RequisitionDocument = Requisition &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'requisitions',
})
export class Requisition {
  // Reference number (auto-generated)
  @Prop({ trim: true, unique: true, sparse: true, index: true })
  referenceNumber?: string;

  // Public submission flag and submitter info
  @Prop({ default: false })
  isPublicSubmission: boolean;

  @Prop({ trim: true })
  submitterName?: string;

  @Prop({ trim: true, lowercase: true })
  submitterEmail?: string;

  @Prop({ trim: true })
  submitterPhone?: string;

  // Reference fields - optional for public submissions
  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member', index: true })
  requestor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', index: true })
  unit?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 200 })
  customUnit?: string;

  @Prop({ type: Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true })
  expenseCategory: Types.ObjectId;

  // Event/Request details
  @Prop({ required: true, trim: true, maxlength: 500 })
  eventDescription: string;

  @Prop({ required: true, type: Date })
  dateNeeded: Date;

  @Prop({ type: String, trim: true })
  lastRequest?: string;

  // Financial details
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({
    type: [
      {
        item: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitCost: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    required: true,
    validate: {
      validator: function (v: CostBreakdownItem[]) {
        return v && v.length > 0;
      },
      message: 'At least one cost breakdown item is required',
    },
  })
  costBreakdown: CostBreakdownItem[];

  // Bank account for disbursement
  @Prop({
    type: {
      bankName: { type: String, required: true },
      accountName: { type: String, required: true },
      accountNumber: { type: String, required: true },
    },
    required: true,
  })
  creditAccount: BankAccountDetails;

  // Supporting documents
  @Prop({ type: [String], default: [] })
  documentUrls: string[];

  // P.Dams discussion confirmation
  @Prop({ required: true, enum: ['yes', 'not_required', 'no'], default: 'no' })
  discussedWithPDams: 'yes' | 'not_required' | 'no';

  @Prop({ type: Date })
  discussedDate?: Date;

  // Workflow status
  @Prop({
    type: String,
    enum: Object.values(RequisitionStatus),
    default: RequisitionStatus.DRAFT,
    index: true,
  })
  status: RequisitionStatus;

  // Submission tracking
  @Prop({ type: Date })
  submittedAt?: Date;

  // Approval tracking
  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  approvedBy?: Types.ObjectId;

  @Prop({ trim: true })
  approvalNotes?: string;

  // Rejection tracking
  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  rejectedBy?: Types.ObjectId;

  @Prop({ trim: true })
  rejectionReason?: string;

  // Disbursement tracking
  @Prop({ type: Date })
  disbursedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  disbursedBy?: Types.ObjectId;

  @Prop({ trim: true })
  disbursementNotes?: string;

  @Prop({ trim: true })
  disbursementReference?: string;

  // Audit fields - optional for public submissions
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const RequisitionSchema = SchemaFactory.createForClass(Requisition);

// Indexes for common queries
RequisitionSchema.index({ branch: 1, status: 1 });
RequisitionSchema.index({ requestor: 1, status: 1 });
RequisitionSchema.index({ expenseCategory: 1 });
RequisitionSchema.index({ dateNeeded: 1 });
RequisitionSchema.index({ createdAt: -1 });
RequisitionSchema.index({ submittedAt: -1 });
RequisitionSchema.index({ approvedBy: 1 });
RequisitionSchema.index({ disbursedBy: 1 });

// Compound index for pending approvals query
RequisitionSchema.index({ branch: 1, status: 1, submittedAt: -1 });

// Text index for search (includes reference number)
RequisitionSchema.index({ eventDescription: 'text', referenceNumber: 'text' });

// Index for public submissions
RequisitionSchema.index({ isPublicSubmission: 1 });
RequisitionSchema.index({ submitterEmail: 1 });

// Pre-save hook to handle legacy boolean values for discussedWithPDams
RequisitionSchema.pre('save', function (next) {
  // Convert legacy boolean values to new enum format
  if (this.discussedWithPDams !== undefined) {
    const value = this.discussedWithPDams as any;
    if (value === true || value === 'true') {
      this.discussedWithPDams = 'yes';
    } else if (value === false || value === 'false') {
      this.discussedWithPDams = 'no';
    }
  }
  next();
});

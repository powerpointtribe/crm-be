import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ─── Giving account (bank details shown on /give) ─────────────────────

export const ACCOUNT_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

export enum AccountApprovalStatus {
  /** Not public until someone other than the maker approves it. */
  DRAFT = 'draft',
  APPROVED = 'approved',
}

/** Fields a maker may change; an approved account keeps them in pendingChange. */
export const ACCOUNT_EDITABLE_FIELDS = [
  'currency',
  'bank',
  'accountNumber',
  'accountName',
  'swift',
  'branch',
  'order',
] as const;

export type GivingAccountDocument = GivingAccount &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'web_giving_accounts',
})
export class GivingAccount {
  @Prop({ type: String, enum: ACCOUNT_CURRENCIES, required: true })
  currency: AccountCurrency;

  @Prop({ required: true, trim: true, maxlength: 120 })
  bank: string;

  @Prop({ required: true, trim: true })
  accountNumber: string;

  @Prop({ trim: true, maxlength: 160 })
  accountName?: string;

  @Prop({ trim: true, uppercase: true })
  swift?: string;

  /** Campus; null = shared by all campuses (usually foreign currency). */
  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null })
  branch?: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({
    type: String,
    enum: Object.values(AccountApprovalStatus),
    default: AccountApprovalStatus.DRAFT,
  })
  approvalStatus: AccountApprovalStatus;

  /** Change requested on an approved account; the public keeps the old values. */
  @Prop({
    type: {
      fields: { type: Object },
      requestedBy: { type: Types.ObjectId, ref: 'Member' },
      requestedAt: Date,
      _id: false,
    },
    default: null,
  })
  pendingChange?: {
    fields: Record<string, unknown>;
    requestedBy: Types.ObjectId;
    requestedAt: Date;
  } | null;

  /** Last person who wrote the draft (cannot approve it). */
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  draftedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const GivingAccountSchema = SchemaFactory.createForClass(GivingAccount);
GivingAccountSchema.index({ approvalStatus: 1, branch: 1, order: 1 });

// ─── Donation (online giving through Flutterwave) ─────────────────────

export const DONATION_FUNDS = [
  'tithe',
  'offering',
  'partnership',
  'project',
] as const;
export type DonationFund = (typeof DONATION_FUNDS)[number];

export enum DonationStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
}

/** `PPTG-` + 24 hex characters. */
export const DONATION_REFERENCE = /^PPTG-[0-9a-f]{24}$/;

export type DonationDocument = Donation & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_donations' })
export class Donation {
  /** Also the Flutterwave tx_ref. */
  @Prop({ required: true })
  reference: string;

  @Prop({ type: String, enum: DONATION_FUNDS, required: true })
  fund: DonationFund;

  /** Naira (major units), like the store. */
  @Prop({ type: Number, required: true, min: 100, max: 10_000_000 })
  amount: number;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  @Prop({
    type: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true },
      _id: false,
    },
    required: true,
  })
  donor: { name?: string; email: string; phone?: string };

  @Prop({
    type: String,
    enum: Object.values(DonationStatus),
    default: DonationStatus.PENDING,
  })
  status: DonationStatus;

  /** Why it failed: provider_error, provider_failed, amount_mismatch. */
  @Prop()
  failureReason?: string;

  @Prop()
  flutterwaveTxId?: string;

  @Prop({ type: Date })
  verifiedAt?: Date;

  /** Last time we asked Flutterwave (status polls are limited to one per 10 s). */
  @Prop({ type: Date, default: null })
  lastCheckedAt?: Date | null;

  /** `PPT-<year>-<000001>`, assigned once when the payment is confirmed. */
  @Prop()
  receiptNo?: string;

  @Prop({
    type: {
      page: String,
      utm: { type: Object },
      _id: false,
    },
  })
  source?: { page?: string; utm?: Record<string, string> };
}

export const DonationSchema = SchemaFactory.createForClass(Donation);
DonationSchema.index({ reference: 1 }, { unique: true });
DonationSchema.index({ status: 1, createdAt: -1 });
DonationSchema.index({ fund: 1, branch: 1, createdAt: -1 });
DonationSchema.index(
  { receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $type: 'string' } } },
);

// ─── Counter (receipt numbers) ────────────────────────────────────────

export type GivingCounterDocument = GivingCounter &
  Document & { _id: Types.ObjectId };

@Schema({ versionKey: false, collection: 'web_counters' })
export class GivingCounter {
  @Prop({ required: true })
  key: string;

  @Prop({ type: Number, default: 0 })
  seq: number;
}

export const GivingCounterSchema = SchemaFactory.createForClass(GivingCounter);
GivingCounterSchema.index({ key: 1 }, { unique: true });

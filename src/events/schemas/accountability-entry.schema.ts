import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccountabilityEntryDocument = AccountabilityEntry & Document;

@Schema({ timestamps: true, versionKey: false })
export class AccountabilityEntry {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EventRegistration', required: true })
  registration: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 12 })
  week: number;

  @Prop({ type: Date })
  weekStartDate?: Date;

  @Prop({ type: String })
  platform?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  postCount: number;

  @Prop({ type: [String], default: [] })
  postLinks: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  engagementRate: number;

  @Prop({ type: Number, default: 0 })
  followerGrowth: number;

  @Prop({ type: Number, default: 0, min: 0, max: 10 })
  consistencyScore: number;

  @Prop({ type: Number, default: 0, min: 0, max: 10 })
  peerReviewScore: number;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  submittedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const AccountabilityEntrySchema =
  SchemaFactory.createForClass(AccountabilityEntry);

AccountabilityEntrySchema.index(
  { event: 1, registration: 1, week: 1 },
  { unique: true },
);
AccountabilityEntrySchema.index({ event: 1, week: 1 });
AccountabilityEntrySchema.index({ registration: 1 });

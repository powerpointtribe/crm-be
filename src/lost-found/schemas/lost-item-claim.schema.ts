import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LostItemClaimDocument = LostItemClaim &
  Document & { _id: Types.ObjectId };

export enum ClaimStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** A "This is mine" claim from the public website. */
@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'web_lost_item_claims',
})
export class LostItemClaim {
  @Prop({ type: Types.ObjectId, ref: 'LostItem', required: true })
  lostItem: Types.ObjectId;

  @Prop({
    type: { name: String, phone: String, _id: false },
    required: true,
  })
  claimant: { name: string; phone: string };

  @Prop({ required: true, trim: true, maxlength: 500 })
  proof: string;

  @Prop({
    type: String,
    enum: Object.values(ClaimStatus),
    default: ClaimStatus.PENDING,
  })
  status: ClaimStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;
}

export const LostItemClaimSchema = SchemaFactory.createForClass(LostItemClaim);
LostItemClaimSchema.index({ status: 1, createdAt: -1 });
LostItemClaimSchema.index({ lostItem: 1 });

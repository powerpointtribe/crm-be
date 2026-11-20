import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LostItemDocument = LostItem & Document & { _id: Types.ObjectId };

export enum LostItemType {
  CLOTHING = 'clothing',
  BAGS = 'bags',
  GADGETS = 'gadgets',
  BOTTLES = 'bottles',
  KEYS = 'keys',
  OTHER = 'other',
}

export enum LostItemStatus {
  /** Posted by the workforce, not public yet. */
  PENDING_REVIEW = 'pending_review',
  /** Public, waiting for its owner. */
  LISTED = 'listed',
  /** Someone tapped "This is mine"; still public. */
  CLAIM_PENDING = 'claim_pending',
  COLLECTED = 'collected',
  /** Unclaimed after 30 days. */
  MOVED_TO_CARE_CLOSET = 'moved_to_care_closet',
}

/** Days an item stays listed before it goes to the Care Closet. */
export const LISTING_DAYS = 30;

export const listedUntilFor = (foundOn: Date) =>
  new Date(foundOn.getTime() + LISTING_DAYS * 86_400_000);

@Schema({ timestamps: true, versionKey: false, collection: 'web_lost_items' })
export class LostItem {
  @Prop({ required: true, trim: true, maxlength: 200 })
  description: string;

  @Prop({ type: String, enum: Object.values(LostItemType), required: true })
  type: LostItemType;

  @Prop({ type: Date, required: true })
  foundOn: Date;

  @Prop({ trim: true })
  photoUrl?: string;

  /** Campus where it was found (and where it is collected). */
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(LostItemStatus),
    default: LostItemStatus.PENDING_REVIEW,
  })
  status: LostItemStatus;

  /** foundOn + 30 days. */
  @Prop({ type: Date, required: true })
  listedUntil: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  postedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const LostItemSchema = SchemaFactory.createForClass(LostItem);
LostItemSchema.index({ status: 1, branch: 1, foundOn: -1 });
LostItemSchema.index({ type: 1 });
LostItemSchema.index({ postedBy: 1, createdAt: -1 });
LostItemSchema.index({ status: 1, listedUntil: 1 });

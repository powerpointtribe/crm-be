import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CouponDocument = Coupon & Document & { _id: Types.ObjectId };

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Schema({ timestamps: true, versionKey: false, collection: 'store_coupons' })
export class Coupon {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(DiscountType),
    required: true,
  })
  discountType: DiscountType;

  @Prop({ type: Number, required: true, min: 0 })
  discountValue: number;

  @Prop({ type: Number, min: 0 })
  maxDiscountAmount?: number;

  @Prop({ type: Number, min: 0 })
  minOrderAmount?: number;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: Number, default: 0 })
  usageCount: number;

  @Prop({ type: Number })
  usageLimit?: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }] })
  applicableProducts?: Types.ObjectId[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ isActive: 1, expiresAt: 1 });

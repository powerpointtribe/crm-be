import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventPartnerDocument = EventPartner &
  Document & { _id: Types.ObjectId };

// Partner inquiry status
export enum PartnerStatus {
  PENDING = 'pending',
  CONTACTED = 'contacted',
  IN_DISCUSSION = 'in_discussion',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EventPartner {
  // Event and Branch References
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branch?: Types.ObjectId;

  // Partner Information
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  company?: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  // Partnership Details
  @Prop({ required: true })
  interestDetails: string;

  // Status
  @Prop({
    type: String,
    enum: Object.values(PartnerStatus),
    default: PartnerStatus.PENDING,
  })
  status: PartnerStatus;

  // Notes and Follow-up
  @Prop({ type: String })
  notes?: string;

  // Assignment
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  assignedTo?: Types.ObjectId;

  // Important Dates
  @Prop({ type: Date, default: Date.now })
  submittedAt: Date;

  @Prop({ type: Date })
  contactedAt?: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: Date })
  declinedAt?: Date;

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EventPartnerSchema =
  SchemaFactory.createForClass(EventPartner);

// Add indexes for better performance
EventPartnerSchema.index({ event: 1 });
EventPartnerSchema.index({ branch: 1 });
EventPartnerSchema.index({ status: 1 });
EventPartnerSchema.index({ email: 1 });
EventPartnerSchema.index({ assignedTo: 1 });
EventPartnerSchema.index({ event: 1, status: 1 });
EventPartnerSchema.index({ event: 1, email: 1 });
EventPartnerSchema.index({ submittedAt: -1 });

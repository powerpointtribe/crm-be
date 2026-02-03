import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailSendLogDocument = EmailSendLog & Document & { _id: Types.ObjectId };

export enum EmailSendStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EmailSendLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'EmailCampaign',
    required: true,
    index: true,
  })
  campaign: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true,
  })
  member: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({
    type: String,
    enum: Object.values(EmailSendStatus),
    default: EmailSendStatus.PENDING,
    index: true,
  })
  status: EmailSendStatus;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  deliveredAt?: Date;

  @Prop({ type: Date })
  openedAt?: Date;

  @Prop({ type: Date })
  clickedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop()
  messageId?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EmailSendLogSchema = SchemaFactory.createForClass(EmailSendLog);

// Indexes
EmailSendLogSchema.index({ campaign: 1, member: 1 }, { unique: true });
EmailSendLogSchema.index({ campaign: 1, status: 1 });
EmailSendLogSchema.index({ campaign: 1, email: 1 });
EmailSendLogSchema.index({ sentAt: -1 });

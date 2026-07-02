import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDraftDocument = MessageDraft & Document;

@Schema({ timestamps: true })
export class MessageDraft {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  scheduledDate: Date; // The date first timers registered (e.g., 2024-01-15)

  @Prop({ required: true })
  scheduledTime: Date; // The time to send the message (e.g., 19:00)

  @Prop({
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy: Types.ObjectId;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Number, default: 0 })
  recipientCount: number;

  @Prop({ type: Number, default: 0 })
  successCount: number;

  @Prop({ type: Number, default: 0 })
  failedCount: number;

  @Prop({ type: String })
  failureReason?: string;

  @Prop({ type: Number, enum: [1, 2, 3], default: 1 })
  templateId: number;

  @Prop({ type: String, default: 'A Message from The PowerPoint Tribe' })
  subject: string;

  @Prop({ type: String, enum: ['by_date', 'individual'], default: 'by_date' })
  recipientMode: string;

  @Prop({ type: [Types.ObjectId], ref: 'FirstTimer' })
  recipientIds?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branch?: Types.ObjectId;

  @Prop({
    type: [
      {
        firstName: String,
        lastName: String,
        email: String,
      },
    ],
    default: undefined,
  })
  recipients?: Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageDraftSchema = SchemaFactory.createForClass(MessageDraft);

// Indexes
MessageDraftSchema.index({ scheduledDate: 1 });
MessageDraftSchema.index({ scheduledTime: 1 });
MessageDraftSchema.index({ status: 1 });
MessageDraftSchema.index({ createdBy: 1 });
MessageDraftSchema.index({ createdAt: -1 });

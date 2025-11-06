import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageHistoryDocument = MessageHistory & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class MessageHistory {
  @Prop({ type: Types.ObjectId, ref: 'FirstTimer', required: true })
  firstTimerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: Date, required: true })
  scheduledTime: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Boolean, default: false })
  isSent: boolean;

  @Prop({ type: Boolean, default: false })
  isCancelled: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  editedBy?: Types.ObjectId;

  @Prop({ type: Date })
  editedAt?: Date;

  @Prop({ trim: true })
  failureReason?: string;

  @Prop({
    type: String,
    enum: ['scheduled', 'sent', 'failed', 'cancelled'],
    default: 'scheduled'
  })
  status: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const MessageHistorySchema = SchemaFactory.createForClass(MessageHistory);

// Indexes for better performance
MessageHistorySchema.index({ firstTimerId: 1 });
MessageHistorySchema.index({ scheduledTime: 1 });
MessageHistorySchema.index({ status: 1 });
MessageHistorySchema.index({ isSent: 1 });
MessageHistorySchema.index({ createdAt: -1 });
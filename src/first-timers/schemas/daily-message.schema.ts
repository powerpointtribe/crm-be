import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailyMessageDocument = DailyMessage & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class DailyMessage {
  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({
    trim: true,
    default: '',
    validate: {
      validator: function (value: string) {
        // Allow empty message only for draft status
        if (this.status !== 'draft' && (!value || value.trim() === '')) {
          return false;
        }
        return true;
      },
      message: 'Message is required for non-draft status',
    },
  })
  message: string;

  @Prop({ type: Date })
  scheduledTime?: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Boolean, default: false })
  autoSend: boolean;

  @Prop({ type: Boolean, default: false })
  isSent: boolean;

  @Prop({ type: Number, default: 0 })
  recipientCount: number;

  @Prop({ type: Number, default: 0 })
  sentCount: number;

  @Prop({ type: Number, default: 0 })
  failedCount: number;

  @Prop({
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft',
  })
  status: string;

  @Prop([{ type: Types.ObjectId, ref: 'FirstTimer' }])
  firstTimerIds: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  sentBy?: Types.ObjectId;

  @Prop({ trim: true })
  failureReason?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const DailyMessageSchema = SchemaFactory.createForClass(DailyMessage);

// Indexes for better performance
DailyMessageSchema.index({ date: 1 });
DailyMessageSchema.index({ status: 1 });
DailyMessageSchema.index({ createdBy: 1 });
DailyMessageSchema.index({ isSent: 1 });
DailyMessageSchema.index({ scheduledTime: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CallReportDocument = CallReport & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class CallReport {
  @Prop({ type: Types.ObjectId, ref: 'FirstTimer', required: true })
  firstTimerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  callMadeBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  callDate: Date;

  @Prop({
    type: String,
    enum: [
      'successful',
      'no_answer',
      'busy',
      'not_interested',
      'interested',
      'follow_up_needed',
      'completed',
    ],
    required: true,
  })
  status: string;

  @Prop({ type: String, required: true })
  notes: string;

  @Prop({ type: String })
  deductions?: string;

  // Service attendance tracking
  @Prop({ type: Boolean, default: false })
  attended2ndService: boolean;

  @Prop({ type: Boolean, default: false })
  attended3rdService: boolean;

  @Prop({ type: Boolean, default: false })
  attended4thService: boolean;

  @Prop({
    type: String,
    enum: ['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call', 'in_visit'],
    required: true,
  })
  contactMethod: string;

  @Prop({ type: Date })
  nextFollowUpDate?: Date;

  @Prop({ type: Number, required: true, min: 1, max: 4 })
  reportNumber: number;

  // Visit number for in_visit contact method (2nd, 3rd, 4th visit)
  @Prop({ type: Number, min: 2, max: 4 })
  visitNumber?: number;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const CallReportSchema = SchemaFactory.createForClass(CallReport);

// Indexes for better performance
CallReportSchema.index({ firstTimerId: 1 });
CallReportSchema.index({ callMadeBy: 1 });
CallReportSchema.index({ callDate: -1 });
CallReportSchema.index({ status: 1 });
CallReportSchema.index({ reportNumber: 1 });
CallReportSchema.index({ firstTimerId: 1, reportNumber: 1 }, { unique: true });

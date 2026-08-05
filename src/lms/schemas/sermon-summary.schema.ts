import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SermonSummaryDocument = SermonSummary &
  Document & { _id: Types.ObjectId };

/**
 * A learner's single summary note for a module's "Messages to listen to"
 * (sermons) — one note per module regardless of how many messages, capped at
 * 500 words. Submitting it counts toward the module's completion.
 */
@Schema({ timestamps: true, versionKey: false })
export class SermonSummary {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'CourseModule',
    required: true,
    index: true,
  })
  module: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  content: string;

  @Prop({ type: Number, default: 0 })
  wordCount: number;

  @Prop({ type: Date })
  submittedAt?: Date;

  // Facilitator grading of the summary (optional score out of 100 + feedback).
  @Prop({ type: Number })
  grade?: number;

  @Prop({ trim: true })
  feedback?: string;

  @Prop({ type: Date })
  gradedAt?: Date;
}

export const SermonSummarySchema = SchemaFactory.createForClass(SermonSummary);
// One summary per learner per module.
SermonSummarySchema.index({ module: 1, registration: 1 }, { unique: true });

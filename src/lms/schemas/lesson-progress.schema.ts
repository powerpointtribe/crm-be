import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonProgressDocument = LessonProgress &
  Document & { _id: Types.ObjectId };

/** A learner's progress + reflection on one lesson (keyed by registration). */
@Schema({ timestamps: true, versionKey: false })
export class LessonProgress {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lesson: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
  })
  status: string;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Number, default: 0 })
  timeSpentSec: number;

  // Number of times the learner has opened this lesson. Incremented on each
  // lesson fetch; powers the facilitator "modules revisited multiple times"
  // metric. viewCount >= 2 means the lesson was re-opened.
  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ trim: true })
  reflection?: string;
}

export const LessonProgressSchema =
  SchemaFactory.createForClass(LessonProgress);
LessonProgressSchema.index({ registration: 1, lesson: 1 }, { unique: true });

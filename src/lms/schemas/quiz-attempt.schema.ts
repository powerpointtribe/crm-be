import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizAttemptDocument = QuizAttempt &
  Document & { _id: Types.ObjectId };

/** A learner's latest attempt at a quiz (keyed by registration + quiz). */
@Schema({ timestamps: true, versionKey: false })
export class QuizAttempt {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true, index: true })
  quiz: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lesson: Types.ObjectId;

  @Prop({ type: [Number], default: [] })
  answers: number[]; // selected option index per question

  @Prop({ type: Number, default: 0 })
  score: number; // percent

  @Prop({ type: Number, default: 0 })
  correctCount: number;

  @Prop({ type: Number, default: 0 })
  total: number;

  @Prop({ type: Boolean, default: false })
  passed: boolean;

  @Prop({ type: Number, default: 0 })
  attempts: number;
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
QuizAttemptSchema.index({ registration: 1, quiz: 1 }, { unique: true });

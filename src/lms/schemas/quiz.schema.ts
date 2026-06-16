import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizDocument = Quiz & Document & { _id: Types.ObjectId };

/**
 * One quiz question. `type` controls the answer format:
 *  - multiple_choice / dropdown — single choice from `options` (correctIndex)
 *  - checkboxes                 — multiple choices from `options` (correctIndexes)
 *  - short_text / long_text / date / file — open answers (recorded, not auto-graded)
 */
export const QUESTION_TYPES = [
  'multiple_choice',
  'dropdown',
  'checkboxes',
  'short_text',
  'long_text',
  'date',
  'file',
] as const;

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  prompt: string;

  @Prop({
    type: String,
    enum: QUESTION_TYPES,
    default: 'multiple_choice',
  })
  type: string;

  @Prop({ type: [String], default: [] })
  options: string[];

  // Single-correct (multiple_choice, dropdown).
  @Prop({ type: Number, default: 0 })
  correctIndex: number;

  // Multi-correct (checkboxes).
  @Prop({ type: [Number], default: [] })
  correctIndexes: number[];

  @Prop({ type: Boolean, default: true })
  required: boolean;

  @Prop({ type: Number, default: 1 })
  points: number;
}

const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

/** A quiz attached to a lesson. One quiz per lesson. */
@Schema({ timestamps: true, versionKey: false })
export class Quiz {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true, index: true })
  lesson: Types.ObjectId;

  @Prop({ trim: true })
  title?: string;

  @Prop({ type: Number, default: 70 })
  passingScore: number; // percent

  @Prop({ type: [QuizQuestionSchema], default: [] })
  questions: QuizQuestion[];

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: string;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);
QuizSchema.index({ lesson: 1 }, { unique: true });

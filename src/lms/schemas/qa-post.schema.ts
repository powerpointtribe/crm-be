import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QaPostDocument = QaPost & Document & { _id: Types.ObjectId };

/**
 * A facilitator-published Q&A entry — a question from the week and its answer
 * (text or audio). Learners view these in a read-only community feed and can
 * drop a reaction (no comments). Follow-up questions go to the support email.
 */
@Schema({ timestamps: true, versionKey: false })
export class QaPost {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  // Optional grouping label shown in the feed (e.g. "Week 1").
  @Prop({ trim: true })
  label?: string;

  @Prop({ required: true, trim: true })
  question: string;

  @Prop({ type: String, enum: ['text', 'audio'], default: 'text' })
  answerType: 'text' | 'audio';

  @Prop({ trim: true })
  answerText?: string;

  @Prop({ trim: true })
  answerAudioUrl?: string;

  @Prop({ trim: true })
  answerAudioName?: string;

  // Reactions — one per learner (registration), toggled. Shown as aggregate
  // emoji counts in the feed.
  @Prop({
    type: [
      {
        registration: { type: Types.ObjectId, ref: 'EventRegistration' },
        emoji: { type: String },
      },
    ],
    default: [],
  })
  reactions: Array<{ registration: Types.ObjectId; emoji: string }>;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const QaPostSchema = SchemaFactory.createForClass(QaPost);
QaPostSchema.index({ event: 1, createdAt: -1 });

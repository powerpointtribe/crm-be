import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubmissionDocument = Submission & Document & { _id: Types.ObjectId };

/** A learner's submission for an assignment (one per registration + assignment). */
@Schema({ timestamps: true, versionKey: false })
export class Submission {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Assignment', required: true, index: true })
  assignment: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ trim: true })
  text?: string;

  @Prop({ trim: true })
  fileUrl?: string;

  @Prop({ trim: true })
  fileName?: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Number, default: null })
  grade?: number | null;

  @Prop({ trim: true })
  feedback?: string;

  @Prop({ type: Date })
  gradedAt?: Date;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);
SubmissionSchema.index({ assignment: 1, registration: 1 }, { unique: true });

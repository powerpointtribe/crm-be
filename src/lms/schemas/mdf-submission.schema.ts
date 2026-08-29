import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MdfSubmissionDocument = MdfSubmission & Document & {
  _id: Types.ObjectId;
};

@Schema({ timestamps: true, versionKey: false })
export class MdfSubmission {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  background: string;

  @Prop({ trim: true, default: '' })
  goal: string;

  @Prop({ trim: true, default: '' })
  initiative: string;

  @Prop({ trim: true, default: '' })
  impact: string;

  @Prop({ type: Number, default: 0 })
  wordCount: number;

  @Prop({ enum: ['draft', 'submitted'], default: 'draft' })
  status: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Number, default: null })
  grade?: number | null;

  @Prop({ trim: true })
  feedback?: string;

  @Prop({ type: Date })
  gradedAt?: Date;
}

export const MdfSubmissionSchema =
  SchemaFactory.createForClass(MdfSubmission);
MdfSubmissionSchema.index(
  { event: 1, registration: 1 },
  { unique: true },
);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LessonDocument = Lesson & Document & { _id: Types.ObjectId };

export interface LessonResource {
  id: string;
  title: string;
  type: string; // pdf | video | slide | link | audio | other
  url: string;
  uploadedBy?: string;
}

/** A lesson within a course module. Carries event for generic, event-scoped reuse. */
@Schema({ timestamps: true, versionKey: false })
export class Lesson {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  module: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  summary?: string;

  // Rich text / markdown / HTML body.
  @Prop()
  content?: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Number })
  durationMinutes?: number;

  @Prop({
    type: [
      {
        id: { type: String },
        title: { type: String },
        type: { type: String },
        url: { type: String },
        uploadedBy: { type: String },
      },
    ],
    default: [],
  })
  resources: LessonResource[];

  @Prop({ trim: true })
  reflectionPrompt?: string;

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: string;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
LessonSchema.index({ event: 1, module: 1, order: 1 });

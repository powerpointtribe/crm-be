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

  // Optional banner images shown at a fixed aspect (object-cover) above the
  // content (header) and below it (footer). Body images are embedded inside
  // `content` as structured blocks.
  @Prop({ trim: true })
  headerImageUrl?: string;

  @Prop({ trim: true })
  footerImageUrl?: string;

  // A lesson created from a published session recording. It appears in the
  // module but is NOT part of the completion criteria (watching a replay is
  // optional — attendance is tracked separately on the session itself).
  @Prop({ type: Boolean, default: false })
  isSessionRecording?: boolean;

  // When true, this lesson is excluded from module/course completion math
  // (set for session recordings; reserved for other optional content).
  @Prop({ type: Boolean, default: false })
  excludeFromCompletion?: boolean;

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

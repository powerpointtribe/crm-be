import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseModuleDocument = CourseModule &
  Document & { _id: Types.ObjectId };

/** A unit of curriculum within an event's course (generic — any event). */
@Schema({ timestamps: true, versionKey: false })
export class CourseModule {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: string;

  // Keep this module out of the 48h "complete the week's module" reminder
  // emails (e.g. a week published early/by mistake). It still shows in the app.
  @Prop({ type: Boolean, default: false })
  excludeFromReminders?: boolean;

  // "Messages to listen to" — one or more audio files attached to the module
  // that learners can play in-page or download. A dedicated section, separate
  // from lessons and their resources.
  @Prop({
    type: [
      {
        id: { type: String },
        title: { type: String, trim: true },
        url: { type: String },
        fileName: { type: String },
        createdAt: { type: Date },
      },
    ],
    default: [],
  })
  audioMessages: Array<{
    id: string;
    title: string;
    url: string;
    fileName?: string;
    createdAt?: Date;
  }>;
}

export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);
CourseModuleSchema.index({ event: 1, order: 1 });

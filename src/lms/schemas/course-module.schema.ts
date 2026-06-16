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
}

export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);
CourseModuleSchema.index({ event: 1, order: 1 });

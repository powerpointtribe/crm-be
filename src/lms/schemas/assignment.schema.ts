import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AssignmentDocument = Assignment & Document & { _id: Types.ObjectId };

/** A facilitator-authored assignment for an event (optionally tied to a lesson). */
@Schema({ timestamps: true, versionKey: false })
export class Assignment {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', index: true })
  lesson?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  instructions?: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Number, default: 100 })
  maxScore: number;

  @Prop({ type: String, enum: ['draft', 'published'], default: 'draft' })
  status: string;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
AssignmentSchema.index({ event: 1, status: 1 });

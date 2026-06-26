import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TestimonyDocument = Testimony & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'testimonies',
})
export class Testimony {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  testimony: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ type: Boolean, default: false })
  isAnonymous: boolean;

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const TestimonySchema = SchemaFactory.createForClass(Testimony);

TestimonySchema.index({ event: 1, createdAt: -1 });

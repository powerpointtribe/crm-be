import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MinistryDocument = Ministry & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Ministry {
  @Prop({ required: true, trim: true, unique: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  director?: Types.ObjectId; // Director in charge of this ministry

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const MinistrySchema = SchemaFactory.createForClass(Ministry);

MinistrySchema.index({ name: 1 });
MinistrySchema.index({ director: 1 });
MinistrySchema.index({ createdAt: -1 });
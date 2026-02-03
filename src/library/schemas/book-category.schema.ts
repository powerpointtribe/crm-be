import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookCategoryDocument = BookCategory & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
})
export class BookCategory {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true, uppercase: true })
  code?: string;

  @Prop({ trim: true, default: '#6366f1' })
  color: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const BookCategorySchema = SchemaFactory.createForClass(BookCategory);

// Indexes
BookCategorySchema.index({ branch: 1, name: 1 }, { unique: true });
BookCategorySchema.index({ branch: 1, code: 1 });
BookCategorySchema.index({ branch: 1, isActive: 1 });
BookCategorySchema.index({ sortOrder: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookDocument = Book & Document & { _id: Types.ObjectId };

export enum BookStatus {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Book {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  author: string;

  @Prop({ trim: true })
  isbn?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  coverImage?: string;

  @Prop({ type: Number, default: 1, min: 0 })
  totalQuantity: number;

  @Prop({ type: Number, default: 1, min: 0 })
  availableQuantity: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'BookCategory',
  })
  category?: Types.ObjectId;

  @Prop({ trim: true })
  publisher?: string;

  @Prop({ type: Date })
  publishedDate?: Date;

  @Prop({ type: Number, min: 0 })
  pageCount?: number;

  @Prop({ trim: true })
  location?: string;

  @Prop([{ type: String, trim: true }])
  tags: string[];

  @Prop({
    type: String,
    enum: Object.values(BookStatus),
    default: BookStatus.AVAILABLE,
  })
  status: BookStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const BookSchema = SchemaFactory.createForClass(Book);

// Pre-save hook to update status based on availability
BookSchema.pre('save', function (next) {
  if (this.availableQuantity === 0) {
    this.status = BookStatus.OUT_OF_STOCK;
  } else if (this.availableQuantity <= Math.ceil(this.totalQuantity * 0.2)) {
    this.status = BookStatus.LOW_STOCK;
  } else {
    this.status = BookStatus.AVAILABLE;
  }
  next();
});

// Indexes
BookSchema.index({ branch: 1, title: 1 });
BookSchema.index({ branch: 1, author: 1 });
BookSchema.index({ branch: 1, isbn: 1 });
BookSchema.index({ branch: 1, category: 1 });
BookSchema.index({ branch: 1, status: 1 });
BookSchema.index({ branch: 1, tags: 1 });
BookSchema.index({ title: 'text', author: 'text', description: 'text' });

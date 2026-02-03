import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BorrowingDocument = Borrowing & Document & { _id: Types.ObjectId };

export enum BorrowingStatus {
  BORROWED = 'borrowed',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  LOST = 'lost',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Borrowing {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branch: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  })
  book: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true,
  })
  member: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  borrowDate: Date;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  returnDate?: Date;

  @Prop({
    type: String,
    enum: Object.values(BorrowingStatus),
    default: BorrowingStatus.BORROWED,
  })
  status: BorrowingStatus;

  @Prop({ type: Boolean, default: false })
  isOverdue: boolean;

  @Prop({ type: Number, default: 0 })
  overdueDays: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
    required: true,
  })
  issuedBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
  })
  returnedTo?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const BorrowingSchema = SchemaFactory.createForClass(Borrowing);

// Virtual to calculate overdue status
BorrowingSchema.virtual('isCurrentlyOverdue').get(function () {
  if (this.status === BorrowingStatus.RETURNED || this.status === BorrowingStatus.LOST) {
    return false;
  }
  return new Date() > this.dueDate;
});

// Virtual to calculate current overdue days
BorrowingSchema.virtual('currentOverdueDays').get(function () {
  if (this.status === BorrowingStatus.RETURNED || this.status === BorrowingStatus.LOST) {
    return this.overdueDays;
  }
  const now = new Date();
  if (now <= this.dueDate) {
    return 0;
  }
  const diffTime = now.getTime() - this.dueDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes
BorrowingSchema.index({ branch: 1, status: 1 });
BorrowingSchema.index({ branch: 1, member: 1, status: 1 });
BorrowingSchema.index({ branch: 1, book: 1, status: 1 });
BorrowingSchema.index({ branch: 1, dueDate: 1, status: 1 });
BorrowingSchema.index({ branch: 1, isOverdue: 1 });
BorrowingSchema.index({ borrowDate: -1 });
BorrowingSchema.index({ dueDate: 1 });

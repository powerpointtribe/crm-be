import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MailingListDocument = MailingList & Document;

export enum MailingListSource {
  CSV_IMPORT = 'csv_import',
  EVENT = 'event',
  MANUAL = 'manual',
}

@Schema({ _id: false, versionKey: false })
export class MailingListContact {
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  member?: Types.ObjectId;
}

export const MailingListContactSchema =
  SchemaFactory.createForClass(MailingListContact);

@Schema({ timestamps: true, versionKey: false })
export class MailingList {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MailingListSource),
    default: MailingListSource.MANUAL,
  })
  source: MailingListSource;

  @Prop({ type: Types.ObjectId, ref: 'Event' })
  sourceEventId?: Types.ObjectId;

  @Prop({ type: [MailingListContactSchema], default: [] })
  contacts: MailingListContact[];

  @Prop({ type: Number, default: 0 })
  contactCount: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const MailingListSchema = SchemaFactory.createForClass(MailingList);

MailingListSchema.index({ branch: 1, name: 1 }, { unique: true });
MailingListSchema.index({ branch: 1 });
MailingListSchema.index({ source: 1 });
MailingListSchema.index({ createdAt: -1 });

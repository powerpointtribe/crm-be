import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PublishStatus } from './publishing';

export type WebSeriesDocument = WebSeries & Document & { _id: Types.ObjectId };

/** A sermon series on the website (/sermons/series/:slug). */
@Schema({ timestamps: true, versionKey: false, collection: 'web_series' })
export class WebSeries {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ trim: true })
  artworkUrl?: string;

  @Prop({ trim: true, maxlength: 200 })
  artworkAlt?: string;

  @Prop({ trim: true, maxlength: 2000 })
  description?: string;

  /** Free-text label, e.g. "Bible Study". */
  @Prop({ trim: true, maxlength: 80 })
  serviceLabel?: string;

  @Prop({ trim: true, maxlength: 120 })
  speaker?: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({
    type: String,
    enum: Object.values(PublishStatus),
    default: PublishStatus.DRAFT,
  })
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebSeriesSchema = SchemaFactory.createForClass(WebSeries);
WebSeriesSchema.index({ slug: 1 }, { unique: true });
WebSeriesSchema.index({ status: 1, startDate: -1 });

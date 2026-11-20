import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PublishStatus } from './publishing';

export type WebSermonDocument = WebSermon & Document & { _id: Types.ObjectId };

export enum SermonService {
  SUNDAY = 'sunday',
  BIBLE_STUDY = 'bible_study',
  SPECIAL = 'special',
}

/** A message on the website's /sermons page. */
@Schema({ timestamps: true, versionKey: false, collection: 'web_sermons' })
export class WebSermon {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug: string;

  /** When it was preached. */
  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, enum: Object.values(SermonService), required: true })
  service: SermonService;

  @Prop({ required: true, trim: true, maxlength: 120 })
  speaker: string;

  /** The 11-character YouTube video id. */
  @Prop({ trim: true })
  youtubeId?: string;

  @Prop({ trim: true })
  audioUrl?: string;

  /** Leave empty to use the YouTube thumbnail. */
  @Prop({ trim: true })
  thumbnailUrl?: string;

  @Prop({ type: Number, min: 0, max: 1000 })
  durationMin?: number;

  @Prop({ type: Number, min: 1, max: 500 })
  partNumber?: number;

  /** Campus it was preached at; null = all campuses / online. */
  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null })
  branch?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'WebSeries', default: null })
  series?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'WebPastor', default: null })
  speakerPastor?: Types.ObjectId | null;

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

export const WebSermonSchema = SchemaFactory.createForClass(WebSermon);
WebSermonSchema.index({ slug: 1 }, { unique: true });
WebSermonSchema.index({ status: 1, date: -1 });
WebSermonSchema.index({ series: 1, partNumber: 1, date: 1 });
WebSermonSchema.index({ branch: 1 });
WebSermonSchema.index({ service: 1 });

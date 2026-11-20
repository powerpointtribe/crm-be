import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PublishStatus } from './publishing';

/*
 * Small, ordered website content lists: devotionals ("Push Buttons"), pastors,
 * testimonies, snippets (units + tribe groups) and FAQs.
 */

const status = {
  type: String,
  enum: Object.values(PublishStatus),
  default: PublishStatus.DRAFT,
};

// ─── Devotional ("Push Buttons") ──────────────────────────────────────

export type WebDevotionalDocument = WebDevotional &
  Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_devotionals' })
export class WebDevotional {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ type: Date, required: true })
  date: Date;

  /** Medium post. */
  @Prop({ trim: true })
  url?: string;

  /** Spotify episode. */
  @Prop({ trim: true })
  audioUrl?: string;

  @Prop({ trim: true, maxlength: 500 })
  excerpt?: string;

  @Prop(status)
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebDevotionalSchema = SchemaFactory.createForClass(WebDevotional);
WebDevotionalSchema.index({ status: 1, date: -1 });

// ─── Pastor ────────────────────────────────────────────────────────────

export type WebPastorDocument = WebPastor & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_pastors' })
export class WebPastor {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  role: string;

  @Prop({ trim: true, maxlength: 2000 })
  bio?: string;

  @Prop({ trim: true })
  photoUrl?: string;

  @Prop({ trim: true, maxlength: 200 })
  photoAlt?: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null })
  branch?: Types.ObjectId | null;

  /** Optional link to the pastor's CRM member record. */
  @Prop({ type: Types.ObjectId, ref: 'Member', default: null })
  member?: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop(status)
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebPastorSchema = SchemaFactory.createForClass(WebPastor);
WebPastorSchema.index({ status: 1, order: 1 });

// ─── Testimony ─────────────────────────────────────────────────────────

export type WebTestimonyDocument = WebTestimony &
  Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_testimonies' })
export class WebTestimony {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  body: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null })
  branch?: Types.ObjectId | null;

  /** Shown publicly only when approved AND published. */
  @Prop({ type: Boolean, default: false })
  approved: boolean;

  /** Set when promoted from an event testimony. */
  @Prop({ type: Types.ObjectId, ref: 'Testimony', default: null })
  sourceTestimony?: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop(status)
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebTestimonySchema = SchemaFactory.createForClass(WebTestimony);
WebTestimonySchema.index({ status: 1, approved: 1, order: 1 });

// ─── Snippet (units to serve in, tribe groups) ────────────────────────

export enum SnippetKind {
  UNIT = 'unit',
  TRIBE_GROUP = 'tribe_group',
}

export type WebSnippetDocument = WebSnippet &
  Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_snippets' })
export class WebSnippet {
  @Prop({ type: String, enum: Object.values(SnippetKind), required: true })
  kind: SnippetKind;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  body: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop(status)
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebSnippetSchema = SchemaFactory.createForClass(WebSnippet);
WebSnippetSchema.index({ kind: 1, status: 1, order: 1 });

// ─── FAQ ───────────────────────────────────────────────────────────────

export enum FaqPage {
  GIVE = 'give',
  VISIT = 'visit',
}

export type WebFaqDocument = WebFaq & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true, versionKey: false, collection: 'web_faqs' })
export class WebFaq {
  @Prop({ type: String, enum: Object.values(FaqPage), required: true })
  page: FaqPage;

  @Prop({ required: true, trim: true, maxlength: 200 })
  question: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  body: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop(status)
  status: PublishStatus;

  @Prop({ type: Date, default: null })
  publishAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebFaqSchema = SchemaFactory.createForClass(WebFaq);
WebFaqSchema.index({ page: 1, status: 1, order: 1 });

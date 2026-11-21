import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebsiteSettingsDocument = WebsiteSettings &
  Document & { _id: Types.ObjectId };

export const PLATFORM_KEYS = [
  'youtube',
  'spotify',
  'mixlr',
  'soundcloud',
  'medium',
  'instagram',
  'facebook',
  'x',
] as const;
export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export const CONTACT_EMAIL_KEYS = [
  'general',
  'finance',
  'welfare',
  'media',
] as const;
export type ContactEmailKey = (typeof CONTACT_EMAIL_KEYS)[number];

export interface ServiceStripItem {
  label: string;
  day: string;
  time: string;
  note?: string;
}

/** Singleton (`key: 'site'`): site-wide settings for nav, footer and home. */
@Schema({ timestamps: true, versionKey: false, collection: 'web_settings' })
export class WebsiteSettings {
  @Prop({ required: true, default: 'site' })
  key: string;

  @Prop({
    type: [
      { label: String, day: String, time: String, note: String, _id: false },
    ],
    default: [],
  })
  serviceStrip: ServiceStripItem[];

  /** https URLs keyed by platform; missing/null = hidden on the site. */
  @Prop({ type: Object, default: {} })
  platformUrls: Partial<Record<PlatformKey, string | null>>;

  @Prop({
    type: { url: String, posterUrl: String, posterAlt: String, _id: false },
    default: {},
  })
  heroVideo: {
    url?: string | null;
    posterUrl?: string | null;
    posterAlt?: string | null;
  };

  /** Next David's Company cohort, shown on /ministries. */
  @Prop({ type: Date, default: null })
  dcCohortDate?: Date | null;

  @Prop({ type: Object, default: {} })
  contactEmails: Partial<Record<ContactEmailKey, string | null>>;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebsiteSettingsSchema =
  SchemaFactory.createForClass(WebsiteSettings);
WebsiteSettingsSchema.index({ key: 1 }, { unique: true });

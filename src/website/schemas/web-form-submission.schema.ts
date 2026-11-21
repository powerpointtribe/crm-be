import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum WebFormType {
  VISIT = 'visit',
  PARTNER = 'partner',
  CARE_DROPOFF = 'care_dropoff',
  DC_INTEREST = 'dc_interest',
  EVENT_NOTIFY = 'event_notify',
}

export enum SubmissionStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  SPAM = 'spam',
}

export interface FormSource {
  page?: string;
  utm?: Record<string, string>;
}

export type WebFormSubmissionDocument = WebFormSubmission &
  Document & { _id: Types.ObjectId };

/** Website inbox: plan a visit, partner, care drop-off, DC interest, event notify. */
@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'web_form_submissions',
})
export class WebFormSubmission {
  @Prop({ type: String, enum: Object.values(WebFormType), required: true })
  formType: WebFormType;

  /** Form-specific fields (validated by the form's DTO before saving). */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({
    type: { name: String, email: String, phone: String, _id: false },
    required: true,
  })
  contact: { name: string; email?: string; phone?: string };

  @Prop({ type: Types.ObjectId, ref: 'Branch', default: null })
  branch?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: Object.values(SubmissionStatus),
    default: SubmissionStatus.NEW,
  })
  status: SubmissionStatus;

  @Prop({ trim: true, maxlength: 2000 })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member', default: null })
  assignedTo?: Types.ObjectId | null;

  /** The consent wording shown next to the form when it was submitted. */
  @Prop({ type: { text: String, version: String, _id: false }, required: true })
  consent: { text: string; version: string };

  @Prop({ type: Object, default: null })
  source?: FormSource | null;

  /** Plan a visit: the CRM first-timer created or matched for this visit. */
  @Prop({ type: Types.ObjectId, ref: 'FirstTimer', default: null })
  firstTimer?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;
}

export const WebFormSubmissionSchema =
  SchemaFactory.createForClass(WebFormSubmission);
WebFormSubmissionSchema.index({ formType: 1, status: 1, createdAt: -1 });
WebFormSubmissionSchema.index({ branch: 1, createdAt: -1 });
WebFormSubmissionSchema.index({ 'contact.email': 1 });
WebFormSubmissionSchema.index({ assignedTo: 1 });

// ─── Sign-ups (merch drop, newsletter) ─────────────────────────────────

export enum SubscriptionList {
  MERCH_DROP = 'merch_drop',
  NEWSLETTER = 'newsletter',
}

export enum SubscriptionChannel {
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export type WebSubscriptionDocument = WebSubscription &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'web_subscriptions',
})
export class WebSubscription {
  @Prop({ type: String, enum: Object.values(SubscriptionList), required: true })
  list: SubscriptionList;

  @Prop({
    type: String,
    enum: Object.values(SubscriptionChannel),
    required: true,
  })
  channel: SubscriptionChannel;

  /** Lowercased email, or a WhatsApp number (digits, optional leading +). */
  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ type: String, enum: ['active', 'unsubscribed'], default: 'active' })
  status: 'active' | 'unsubscribed';

  @Prop({ type: { text: String, version: String, _id: false }, required: true })
  consent: { text: string; version: string };

  @Prop({ type: Object, default: null })
  source?: FormSource | null;
}

export const WebSubscriptionSchema =
  SchemaFactory.createForClass(WebSubscription);
WebSubscriptionSchema.index(
  { list: 1, channel: 1, address: 1 },
  { unique: true },
);
WebSubscriptionSchema.index({ list: 1, createdAt: -1 });

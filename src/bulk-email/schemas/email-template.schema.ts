import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailTemplateDocument = EmailTemplate & Document & { _id: Types.ObjectId };

export enum TemplateCategory {
  GENERAL = 'general',
  WELCOME = 'welcome',
  ANNOUNCEMENT = 'announcement',
  EVENT = 'event',
  REMINDER = 'reminder',
  NEWSLETTER = 'newsletter',
}

export const AVAILABLE_TEMPLATE_VARIABLES = [
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'branchName',
  'districtName',
  'unitName',
  'membershipStatus',
  'dateJoined',
] as const;

export type TemplateVariable = (typeof AVAILABLE_TEMPLATE_VARIABLES)[number];

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EmailTemplate {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
    index: true,
  })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true })
  htmlContent: string;

  @Prop()
  plainTextContent?: string;

  @Prop({
    type: [String],
    default: ['firstName', 'lastName', 'email'],
  })
  availableVariables: string[];

  @Prop({
    type: String,
    enum: Object.values(TemplateCategory),
    default: TemplateCategory.GENERAL,
  })
  category: TemplateCategory;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);

// Indexes
EmailTemplateSchema.index({ branch: 1, name: 1 }, { unique: true });
EmailTemplateSchema.index({ branch: 1, category: 1 });
EmailTemplateSchema.index({ branch: 1, isActive: 1 });
EmailTemplateSchema.index({ name: 'text', subject: 'text' });

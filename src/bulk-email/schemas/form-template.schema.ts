import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FormTemplateDocument = FormTemplate & Document & { _id: Types.ObjectId };

export enum FormFieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  NUMBER = 'number',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  TOGGLE = 'toggle',
  RATING = 'rating',
  DATE = 'date',
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
}

export enum FormTheme {
  DEFAULT = 'default',
  DARK = 'dark',
  CUSTOM = 'custom',
}

export enum FormModule {
  EVENTS = 'events',
  FIRST_TIMERS = 'first-timers',
  MEMBERS = 'members',
  GENERAL = 'general',
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

@Schema({ _id: false, versionKey: false })
export class FormField {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, type: String, enum: Object.values(FormFieldType) })
  type: FormFieldType;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ trim: true })
  placeholder?: string;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: String, enum: ['full', 'half'], default: 'full' })
  width: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({
    type: [{ label: { type: String }, value: { type: String } }],
    default: [],
  })
  options: FormFieldOption[];

  @Prop({
    type: {
      min: { type: Number },
      max: { type: Number },
      minLength: { type: Number },
      maxLength: { type: Number },
      pattern: { type: String },
    },
    default: {},
  })
  validation: FormFieldValidation;

  @Prop({ trim: true })
  helpText?: string;

  @Prop({ trim: true })
  defaultValue?: string;
}

export const FormFieldSchema = SchemaFactory.createForClass(FormField);

@Schema({ _id: false, versionKey: false })
export class FormStyle {
  @Prop({ type: String, enum: Object.values(FormTheme), default: FormTheme.DEFAULT })
  theme: FormTheme;

  @Prop({ trim: true })
  primaryColor?: string;

  @Prop({ trim: true })
  backgroundColor?: string;

  @Prop({ trim: true })
  textColor?: string;

  @Prop({ trim: true })
  cardColor?: string;

  @Prop({ trim: true })
  fontFamily?: string;

  @Prop({ trim: true })
  headingFontFamily?: string;
}

export const FormStyleSchema = SchemaFactory.createForClass(FormStyle);

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'form_templates',
})
export class FormTemplate {
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    index: true,
  })
  branch?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, sparse: true })
  slug?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(FormModule),
    default: FormModule.GENERAL,
  })
  module: FormModule;

  @Prop({ type: [FormFieldSchema], default: [] })
  fields: FormField[];

  @Prop({ type: String })
  htmlContent?: string;

  @Prop({ type: FormStyleSchema, default: () => ({}) })
  style: FormStyle;

  @Prop({ trim: true, default: 'Submit' })
  submitButtonText: string;

  @Prop({ trim: true, default: 'Thank you for your submission.' })
  successMessage: string;

  @Prop({ trim: true })
  successHeading?: string;

  @Prop({ default: false })
  allowAnonymous: boolean;

  @Prop({ default: false })
  isSystem: boolean;

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

export const FormTemplateSchema = SchemaFactory.createForClass(FormTemplate);

FormTemplateSchema.index(
  { branch: 1, name: 1 },
  { unique: true, partialFilterExpression: { branch: { $exists: true } } },
);
FormTemplateSchema.index({ slug: 1 }, { unique: true, sparse: true });
FormTemplateSchema.index({ module: 1, isActive: 1 });
FormTemplateSchema.index({ branch: 1, isActive: 1 });
FormTemplateSchema.index({ name: 'text', description: 'text' });

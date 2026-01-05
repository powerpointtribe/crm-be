import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Field types for dynamic form fields
export enum FormFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  FILE = 'file',
}

// Embedded schema for select options
export class SelectOption {
  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  value: string;
}

// Embedded schema for field validation
export class FieldValidation {
  @Prop({ default: false })
  required: boolean;

  @Prop()
  minLength?: number;

  @Prop()
  maxLength?: number;

  @Prop()
  min?: number;

  @Prop()
  max?: number;

  @Prop()
  pattern?: string;

  @Prop()
  patternMessage?: string;
}

export type FormFieldConfigDocument = FormFieldConfig &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'form_field_configs',
})
export class FormFieldConfig {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  // Form identifier (e.g., 'requisition')
  @Prop({ required: true, trim: true, index: true })
  formType: string;

  // Field identifier (unique within form)
  @Prop({ required: true, trim: true })
  fieldKey: string;

  // Display label
  @Prop({ required: true, trim: true })
  label: string;

  // Placeholder text
  @Prop({ trim: true })
  placeholder?: string;

  // Help text displayed below field
  @Prop({ trim: true })
  helpText?: string;

  // Field type
  @Prop({
    type: String,
    enum: Object.values(FormFieldType),
    required: true,
  })
  fieldType: FormFieldType;

  // Options for select fields
  @Prop({
    type: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    default: [],
  })
  options: SelectOption[];

  // Validation rules
  @Prop({
    type: {
      required: { type: Boolean, default: false },
      minLength: { type: Number },
      maxLength: { type: Number },
      min: { type: Number },
      max: { type: Number },
      pattern: { type: String },
      patternMessage: { type: String },
    },
    default: {},
  })
  validation: FieldValidation;

  // Default value
  @Prop()
  defaultValue?: string;

  // Whether this is a system field (cannot be deleted)
  @Prop({ default: false })
  isSystemField: boolean;

  // Whether field is active
  @Prop({ default: true })
  isActive: boolean;

  // Display order
  @Prop({ default: 0 })
  sortOrder: number;

  // Which step the field belongs to (1 or 2)
  @Prop({ required: true, min: 1, max: 2, default: 1 })
  step: number;

  // Grid column span (1-12 for responsive layout)
  @Prop({ default: 12, min: 1, max: 12 })
  gridSpan: number;

  // Audit fields
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const FormFieldConfigSchema =
  SchemaFactory.createForClass(FormFieldConfig);

// Indexes
FormFieldConfigSchema.index({ branch: 1, formType: 1 });
FormFieldConfigSchema.index({ branch: 1, formType: 1, fieldKey: 1 }, { unique: true });
FormFieldConfigSchema.index({ sortOrder: 1 });
FormFieldConfigSchema.index({ step: 1 });
FormFieldConfigSchema.index({ isActive: 1 });

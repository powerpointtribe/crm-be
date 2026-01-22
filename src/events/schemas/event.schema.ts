import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventDocument = Event & Document & { _id: Types.ObjectId };

// Event types
export enum EventType {
  CONFERENCE = 'conference',
  WORKSHOP = 'workshop',
  SEMINAR = 'seminar',
  RETREAT = 'retreat',
  SERVICE = 'service',
  OUTREACH = 'outreach',
  MEETING = 'meeting',
  CELEBRATION = 'celebration',
  TRAINING = 'training',
  OTHER = 'other',
}

// Event status
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

// Location type definition
export interface EventLocation {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  isVirtual: boolean;
  virtualLink?: string;
}

// Custom field type definition
export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[];
}

// Registration settings type definition
export interface RegistrationSettings {
  isOpen: boolean;
  maxAttendees?: number;
  deadline?: Date;
  requireApproval: boolean;
  allowWaitlist: boolean;
  customFields: CustomField[];
}

// Committee member type definition
export interface CommitteeMember {
  member: Types.ObjectId;
  role: string;
  assignedAt: Date;
}

// Training configuration for training-type events
export interface TrainingConfig {
  hasMultipleSessions: boolean;
  totalSessions: number;
  requireAllSessions: boolean;
  minimumAttendancePercentage: number;
  hasCertification: boolean;
  certificateTemplate?: string;
  passingScore?: number;
  allowRetakes: boolean;
  maxRetakes?: number;
}

// Completion requirement type
export interface CompletionRequirement {
  type: 'attendance' | 'assessment' | 'assignment' | 'participation';
  description: string;
  isRequired: boolean;
  weight: number; // percentage weight for overall completion
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Event {
  // Basic Information
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(EventType),
    default: EventType.OTHER,
  })
  type: EventType;

  @Prop({
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  // Date and Time
  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: String })
  startTime?: string;

  @Prop({ type: String })
  endTime?: string;

  // Location
  @Prop({
    type: {
      name: { type: String, default: '' },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      isVirtual: { type: Boolean, default: false },
      virtualLink: { type: String },
    },
    default: {
      name: '',
      address: '',
      city: '',
      state: '',
      isVirtual: false,
    },
  })
  location: EventLocation;

  // Registration Settings
  @Prop({
    type: {
      isOpen: { type: Boolean, default: true },
      maxAttendees: { type: Number },
      deadline: { type: Date },
      requireApproval: { type: Boolean, default: false },
      allowWaitlist: { type: Boolean, default: true },
      customFields: [
        {
          id: { type: String },
          label: { type: String },
          type: {
            type: String,
            enum: ['text', 'textarea', 'select', 'checkbox', 'radio'],
          },
          required: { type: Boolean, default: false },
          options: [{ type: String }],
        },
      ],
    },
    default: {
      isOpen: true,
      requireApproval: false,
      allowWaitlist: true,
      customFields: [],
    },
  })
  registrationSettings: RegistrationSettings;

  // Registration Slug for Public URL
  @Prop({ unique: true, sparse: true, trim: true, lowercase: true })
  registrationSlug?: string;

  // Committee Members
  @Prop({
    type: [
      {
        member: { type: Types.ObjectId, ref: 'Member' },
        role: { type: String },
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  committee: CommitteeMember[];

  // Organizer and Branch
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  organizer?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  // Additional Details
  @Prop({ trim: true })
  bannerImage?: string;

  @Prop({ trim: true, lowercase: true })
  contactEmail?: string;

  @Prop({ trim: true })
  contactPhone?: string;

  @Prop([{ type: String }])
  tags: string[];

  // Denormalized Counts
  @Prop({ type: Number, default: 0 })
  registrationCount: number;

  @Prop({ type: Number, default: 0 })
  confirmedCount: number;

  @Prop({ type: Number, default: 0 })
  attendedCount: number;

  // Training-specific Configuration (for training events)
  @Prop({
    type: {
      hasMultipleSessions: { type: Boolean, default: false },
      totalSessions: { type: Number, default: 1 },
      requireAllSessions: { type: Boolean, default: false },
      minimumAttendancePercentage: { type: Number, default: 80 },
      hasCertification: { type: Boolean, default: false },
      certificateTemplate: { type: String },
      passingScore: { type: Number },
      allowRetakes: { type: Boolean, default: true },
      maxRetakes: { type: Number, default: 3 },
    },
    default: {
      hasMultipleSessions: false,
      totalSessions: 1,
      requireAllSessions: false,
      minimumAttendancePercentage: 80,
      hasCertification: false,
      allowRetakes: true,
      maxRetakes: 3,
    },
  })
  trainingConfig?: TrainingConfig;

  // Completion Requirements
  @Prop({
    type: [
      {
        type: {
          type: String,
          enum: ['attendance', 'assessment', 'assignment', 'participation'],
        },
        description: { type: String },
        isRequired: { type: Boolean, default: true },
        weight: { type: Number, default: 100 },
      },
    ],
    default: [],
  })
  completionRequirements: CompletionRequirement[];

  // Session tracking counts (for multi-session events)
  @Prop({ type: Number, default: 0 })
  sessionCount: number;

  @Prop({ type: Number, default: 0 })
  completedSessionCount: number;

  // Completion tracking
  @Prop({ type: Number, default: 0 })
  completedCount: number; // Number of attendees who completed all requirements

  @Prop({ type: Number, default: 0 })
  certifiedCount: number; // Number of attendees who received certification

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Add indexes for better performance
EventSchema.index({ title: 'text', description: 'text' });
EventSchema.index({ branch: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ type: 1 });
EventSchema.index({ startDate: 1 });
EventSchema.index({ endDate: 1 });
EventSchema.index({ registrationSlug: 1 });
EventSchema.index({ organizer: 1 });
EventSchema.index({ 'committee.member': 1 });
EventSchema.index({ branch: 1, status: 1, startDate: -1 });
EventSchema.index({ tags: 1 });

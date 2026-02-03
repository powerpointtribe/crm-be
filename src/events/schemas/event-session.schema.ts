import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventSessionDocument = EventSession & Document & { _id: Types.ObjectId };

// Session status
export enum SessionStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Session type for different kinds of activities
export enum SessionType {
  LECTURE = 'lecture',
  WORKSHOP = 'workshop',
  PRACTICAL = 'practical',
  ASSESSMENT = 'assessment',
  DISCUSSION = 'discussion',
  BREAK = 'break',
  OTHER = 'other',
}

// Learning objective type
export interface LearningObjective {
  id: string;
  description: string;
  required: boolean;
}

// Resource/Material type
export interface SessionResource {
  id: string;
  title: string;
  type: 'document' | 'video' | 'link' | 'presentation' | 'other';
  url?: string;
  description?: string;
}

// Facilitator assignment
export interface SessionFacilitator {
  member: Types.ObjectId;
  role: 'lead' | 'assistant' | 'guest';
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EventSession {
  // Parent Event Reference
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  // Session Details
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(SessionType),
    default: SessionType.LECTURE,
  })
  sessionType: SessionType;

  @Prop({
    type: String,
    enum: Object.values(SessionStatus),
    default: SessionStatus.SCHEDULED,
  })
  status: SessionStatus;

  // Order/Sequence within the event
  @Prop({ type: Number, required: true, default: 1 })
  order: number;

  // Scheduling
  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String, required: true })
  startTime: string;

  @Prop({ type: String, required: true })
  endTime: string;

  @Prop({ type: Number })
  durationMinutes?: number;

  // Location (can be different from main event)
  @Prop({
    type: {
      name: { type: String },
      isVirtual: { type: Boolean, default: false },
      virtualLink: { type: String },
    },
  })
  location?: {
    name?: string;
    isVirtual: boolean;
    virtualLink?: string;
  };

  // Facilitators/Instructors
  @Prop({
    type: [
      {
        member: { type: Types.ObjectId, ref: 'Member' },
        role: { type: String, enum: ['lead', 'assistant', 'guest'], default: 'lead' },
      },
    ],
    default: [],
  })
  facilitators: SessionFacilitator[];

  // Learning Objectives (for training events)
  @Prop({
    type: [
      {
        id: { type: String },
        description: { type: String },
        required: { type: Boolean, default: true },
      },
    ],
    default: [],
  })
  learningObjectives: LearningObjective[];

  // Resources/Materials
  @Prop({
    type: [
      {
        id: { type: String },
        title: { type: String },
        type: { type: String, enum: ['document', 'video', 'link', 'presentation', 'other'] },
        url: { type: String },
        description: { type: String },
      },
    ],
    default: [],
  })
  resources: SessionResource[];

  // Assessment Configuration
  @Prop({
    type: {
      hasAssessment: { type: Boolean, default: false },
      assessmentType: { type: String, enum: ['quiz', 'assignment', 'practical', 'presentation'] },
      passingScore: { type: Number },
      maxScore: { type: Number },
      required: { type: Boolean, default: false },
    },
    default: { hasAssessment: false },
  })
  assessment: {
    hasAssessment: boolean;
    assessmentType?: 'quiz' | 'assignment' | 'practical' | 'presentation';
    passingScore?: number;
    maxScore?: number;
    required?: boolean;
  };

  // Attendance Tracking Configuration
  @Prop({
    type: {
      isRequired: { type: Boolean, default: true },
      allowLateArrival: { type: Boolean, default: true },
      lateArrivalThresholdMinutes: { type: Number, default: 15 },
    },
    default: { isRequired: true, allowLateArrival: true, lateArrivalThresholdMinutes: 15 },
  })
  attendanceConfig: {
    isRequired: boolean;
    allowLateArrival: boolean;
    lateArrivalThresholdMinutes: number;
  };

  // Denormalized Counts
  @Prop({ type: Number, default: 0 })
  attendanceCount: number;

  @Prop({ type: Number, default: 0 })
  lateCount: number;

  @Prop({ type: Number, default: 0 })
  absentCount: number;

  // Notes for the session
  @Prop({ trim: true })
  notes?: string;

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EventSessionSchema = SchemaFactory.createForClass(EventSession);

// Indexes
EventSessionSchema.index({ event: 1 });
EventSessionSchema.index({ branch: 1 });
EventSessionSchema.index({ date: 1 });
EventSessionSchema.index({ status: 1 });
EventSessionSchema.index({ event: 1, order: 1 });
EventSessionSchema.index({ event: 1, date: 1 });
EventSessionSchema.index({ 'facilitators.member': 1 });

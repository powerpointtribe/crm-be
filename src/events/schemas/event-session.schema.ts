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

  // Optional: global events (isGlobal) are not scoped to a branch.
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branch?: Types.ObjectId;

  // Optional link to the course module this session belongs to. When set, the
  // learner portal surfaces "Join live session" inside that module until the
  // recording is published (which then replaces it). Not a completion metric.
  @Prop({ type: Types.ObjectId, ref: 'CourseModule' })
  moduleId?: Types.ObjectId;

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

  // Zoom meeting/webinar ID this session runs on (for embedded viewing via the
  // Meeting SDK and auto-attendance via the Zoom report API). For a recurring
  // meeting/webinar the same ID is shared across sessions; the correct
  // occurrence is resolved by the session date at sync time.
  @Prop({ type: String, trim: true })
  zoomMeetingId?: string;

  // Whether zoomMeetingId is a regular meeting or a webinar (webinar is used
  // for large cohorts). Drives which Zoom report/instances endpoints are called.
  @Prop({ type: String, enum: ['meeting', 'webinar'], default: 'meeting' })
  zoomType?: 'meeting' | 'webinar';

  // Meeting/webinar passcode — required by the embedded SDK join when the Zoom
  // meeting has a passcode set (Zoom enables one by default).
  @Prop({ type: String, trim: true })
  zoomPasscode?: string;

  // YouTube simulcast link/ID. When set alongside zoomMeetingId, viewers who
  // arrive after Zoom fills its live capacity are routed to this stream instead
  // (see LmsService.getWatchSource). Attendance still comes from the heartbeat.
  @Prop({ type: String, trim: true })
  youtubeStreamUrl?: string;

  // Set when attendance was last pulled from Zoom for this session.
  @Prop({ type: Date })
  zoomAttendanceSyncedAt?: Date;

  // Set when the facilitator ends the live session (e.g. after ending the Zoom
  // meeting as host). From this moment the portal treats the session as ended —
  // no longer LIVE — regardless of the scheduled end time. Cleared to reopen.
  @Prop({ type: Date })
  liveEndedAt?: Date;

  // Access control. 'all' (default) = every accepted learner sees this session.
  // 'restricted' = only the registrations in `allowedRegistrations` can see or
  // join it (a private session for a select group).
  @Prop({ type: String, enum: ['all', 'restricted'], default: 'all' })
  visibility?: 'all' | 'restricted';

  @Prop({ type: [{ type: Types.ObjectId, ref: 'EventRegistration' }], default: [] })
  allowedRegistrations?: Types.ObjectId[];

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
      // Minutes of watch-time needed to be marked attended (0/undefined =>
      // fall back to the ATTENDANCE_PRESENT_THRESHOLD_MINUTES env / 10).
      presentThresholdMinutes: { type: Number },
    },
    default: { isRequired: true, allowLateArrival: true, lateArrivalThresholdMinutes: 15 },
  })
  attendanceConfig: {
    isRequired: boolean;
    allowLateArrival: boolean;
    lateArrivalThresholdMinutes: number;
    presentThresholdMinutes?: number;
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

  // Recording (YouTube VOD) — populated automatically after the live session
  // ends. `available` flips true when detected; `notifiedAt` guards the
  // facilitator email; the published* fields link the replay lesson once the
  // facilitator publishes it into a module.
  @Prop({
    type: {
      available: { type: Boolean, default: false },
      url: { type: String },
      videoId: { type: String },
      endedAt: { type: Date },
      notifiedAt: { type: Date },
      publishedLessonId: { type: Types.ObjectId, ref: 'Lesson' },
      publishedModuleId: { type: Types.ObjectId, ref: 'CourseModule' },
      publishedAt: { type: Date },
    },
    default: {},
  })
  recording?: {
    available: boolean;
    url?: string;
    videoId?: string;
    endedAt?: Date;
    notifiedAt?: Date;
    publishedLessonId?: Types.ObjectId;
    publishedModuleId?: Types.ObjectId;
    publishedAt?: Date;
  };

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

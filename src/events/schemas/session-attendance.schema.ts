import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionAttendanceDocument = SessionAttendance & Document & { _id: Types.ObjectId };

// Attendance status for a session
export enum SessionAttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  EXCUSED = 'excused',
}

// Learning objective completion tracking
export interface ObjectiveCompletion {
  objectiveId: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
}

// Assessment result for a session
export interface AssessmentResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: Date;
  feedback?: string;
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class SessionAttendance {
  // References
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EventSession', required: true })
  session: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'EventRegistration', required: true })
  registration: Types.ObjectId;

  // Optional: global events (isGlobal) are not scoped to a branch.
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branch?: Types.ObjectId;

  // Optional member reference (for member attendees)
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  member?: Types.ObjectId;

  // Attendance Status
  @Prop({
    type: String,
    enum: Object.values(SessionAttendanceStatus),
    default: SessionAttendanceStatus.ABSENT,
  })
  status: SessionAttendanceStatus;

  // Check-in/Check-out Times
  @Prop({ type: Date })
  checkInTime?: Date;

  @Prop({ type: Date })
  checkOutTime?: Date;

  // Duration tracking (in minutes)
  @Prop({ type: Number })
  attendedMinutes?: number;

  // Late arrival tracking
  @Prop({ type: Number, default: 0 })
  lateByMinutes: number;

  // Learning Objectives Completion
  @Prop({
    type: [
      {
        objectiveId: { type: String },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
        notes: { type: String },
      },
    ],
    default: [],
  })
  objectivesCompletion: ObjectiveCompletion[];

  // Assessment Results (for sessions with assessments)
  @Prop({
    type: {
      score: { type: Number },
      maxScore: { type: Number },
      percentage: { type: Number },
      passed: { type: Boolean },
      attemptNumber: { type: Number, default: 1 },
      submittedAt: { type: Date },
      feedback: { type: String },
    },
  })
  assessmentResult?: AssessmentResult;

  // Participation tracking
  @Prop({
    type: {
      participated: { type: Boolean, default: false },
      participationNotes: { type: String },
      engagementLevel: { type: String, enum: ['low', 'medium', 'high'] },
    },
    default: { participated: false },
  })
  participation: {
    participated: boolean;
    participationNotes?: string;
    engagementLevel?: 'low' | 'medium' | 'high';
  };

  // Notes from facilitator
  @Prop({ trim: true })
  facilitatorNotes?: string;

  // Who recorded this attendance
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  recordedBy?: Types.ObjectId;

  @Prop({ type: Date })
  recordedAt?: Date;

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const SessionAttendanceSchema = SchemaFactory.createForClass(SessionAttendance);

// Indexes
SessionAttendanceSchema.index({ event: 1 });
SessionAttendanceSchema.index({ session: 1 });
SessionAttendanceSchema.index({ registration: 1 });
SessionAttendanceSchema.index({ branch: 1 });
SessionAttendanceSchema.index({ member: 1 });
SessionAttendanceSchema.index({ status: 1 });
SessionAttendanceSchema.index({ session: 1, registration: 1 }, { unique: true });
SessionAttendanceSchema.index({ event: 1, member: 1 });
SessionAttendanceSchema.index({ 'assessmentResult.passed': 1 });

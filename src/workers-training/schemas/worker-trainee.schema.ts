import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  WorkersTrainingStatus,
  AttendanceStatus,
  AssignmentStatus,
  TrainingOutcome,
} from '../../common/enums/workers-training.enum';

export type WorkerTraineeDocument = WorkerTrainee &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'worker_trainees',
})
export class WorkerTrainee {
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  member: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cohort', required: true })
  cohort: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WorkersTrainingStatus),
    default: WorkersTrainingStatus.REGISTERED,
  })
  status: WorkersTrainingStatus;

  @Prop({ type: Date, default: Date.now })
  enrollmentDate: Date;

  @Prop({ type: Date })
  completionDate?: Date;

  @Prop({ type: Date })
  graduationDate?: Date;

  @Prop({ type: Date })
  dropoutDate?: Date;

  @Prop({ type: String })
  dropoutReason?: string;

  // Academic tracking
  @Prop({
    type: {
      totalSessions: { type: Number, default: 0 },
      attendedSessions: { type: Number, default: 0 },
      attendancePercentage: { type: Number, default: 0 },
      excusedAbsences: { type: Number, default: 0 },
    },
    default: {},
  })
  attendance: {
    totalSessions: number;
    attendedSessions: number;
    attendancePercentage: number;
    excusedAbsences: number;
  };

  @Prop([
    {
      sessionId: { type: Types.ObjectId, required: true },
      sessionDate: { type: Date, required: true },
      status: {
        type: String,
        enum: Object.values(AttendanceStatus),
        required: true,
      },
      checkinTime: Date,
      checkoutTime: Date,
      notes: String,
      markedBy: { type: Types.ObjectId, ref: 'Member' },
    },
  ])
  attendanceRecords: Array<{
    sessionId: Types.ObjectId;
    sessionDate: Date;
    status: AttendanceStatus;
    checkinTime?: Date;
    checkoutTime?: Date;
    notes?: string;
    markedBy?: Types.ObjectId;
  }>;

  // Assignment and grading
  @Prop([
    {
      assignmentId: { type: Types.ObjectId, required: true },
      title: { type: String, required: true },
      status: {
        type: String,
        enum: Object.values(AssignmentStatus),
        default: AssignmentStatus.NOT_SUBMITTED,
      },
      submissionDate: Date,
      dueDate: Date,
      score: Number,
      maxScore: Number,
      grade: String,
      feedback: String,
      attempts: { type: Number, default: 0 },
      isLateSubmission: { type: Boolean, default: false },
      gradedBy: { type: Types.ObjectId, ref: 'Member' },
    },
  ])
  assignments: Array<{
    assignmentId: Types.ObjectId;
    title: string;
    status: AssignmentStatus;
    submissionDate?: Date;
    dueDate: Date;
    score?: number;
    maxScore: number;
    grade?: string;
    feedback?: string;
    attempts: number;
    isLateSubmission: boolean;
    gradedBy?: Types.ObjectId;
  }>;

  @Prop({
    type: {
      overallGrade: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      totalAssignments: { type: Number, default: 0 },
      submittedAssignments: { type: Number, default: 0 },
      gradedAssignments: { type: Number, default: 0 },
      passedAssignments: { type: Number, default: 0 },
    },
    default: {},
  })
  academicPerformance: {
    overallGrade: number;
    averageScore: number;
    totalAssignments: number;
    submittedAssignments: number;
    gradedAssignments: number;
    passedAssignments: number;
  };

  // Mentor and supervision
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  assignedMentor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  supervisor?: Types.ObjectId;

  @Prop([
    {
      date: { type: Date, required: true },
      mentor: { type: Types.ObjectId, ref: 'Member', required: true },
      type: { type: String, required: true }, // e.g., 'one-on-one', 'group', 'performance review'
      duration: Number, // in minutes
      topics: [String],
      notes: String,
      actionItems: [String],
      nextMeetingDate: Date,
    },
  ])
  mentoringRecords: Array<{
    date: Date;
    mentor: Types.ObjectId;
    type: string;
    duration?: number;
    topics?: string[];
    notes?: string;
    actionItems?: string[];
    nextMeetingDate?: Date;
  }>;

  // Progress and evaluation
  @Prop([
    {
      date: { type: Date, required: true },
      evaluator: { type: Types.ObjectId, ref: 'Member', required: true },
      type: { type: String, required: true }, // e.g., 'mid-term', 'final', 'performance'
      scores: {
        technical: Number,
        leadership: Number,
        character: Number,
        ministry: Number,
        overall: Number,
      },
      strengths: [String],
      areasForImprovement: [String],
      recommendations: [String],
      notes: String,
    },
  ])
  evaluations: Array<{
    date: Date;
    evaluator: Types.ObjectId;
    type: string;
    scores: {
      technical?: number;
      leadership?: number;
      character?: number;
      ministry?: number;
      overall?: number;
    };
    strengths?: string[];
    areasForImprovement?: string[];
    recommendations?: string[];
    notes?: string;
  }>;

  // Post-training placement
  @Prop({
    type: String,
    enum: Object.values(TrainingOutcome),
  })
  outcome?: TrainingOutcome;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  assignedUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  assignedDistrict?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  assignedMinistries?: Types.ObjectId[];

  @Prop({ type: String })
  newRole?: string;

  @Prop({ type: Date })
  placementDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  placementApprovedBy?: Types.ObjectId;

  // Administrative
  @Prop({ type: String })
  emergencyContact?: string;

  @Prop({ type: String })
  emergencyPhone?: string;

  @Prop({ type: String })
  medicalNotes?: string;

  @Prop({ type: String })
  dietaryRestrictions?: string;

  @Prop({ type: Boolean, default: false })
  hasTransportation: boolean;

  @Prop({ type: Boolean, default: false })
  needsAccommodation: boolean;

  @Prop({ type: String })
  accommodationDetails?: string;

  @Prop([String])
  tags?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  enrolledBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const WorkerTraineeSchema = SchemaFactory.createForClass(WorkerTrainee);

// Unique constraint to prevent duplicate enrollment
WorkerTraineeSchema.index({ member: 1, cohort: 1 }, { unique: true });

// Other indexes for better query performance
WorkerTraineeSchema.index({ member: 1, status: 1 });
WorkerTraineeSchema.index({ cohort: 1, status: 1 });
WorkerTraineeSchema.index({ enrollmentDate: -1 });
WorkerTraineeSchema.index({ status: 1, enrollmentDate: -1 });
WorkerTraineeSchema.index({ assignedMentor: 1 });
WorkerTraineeSchema.index({ supervisor: 1 });
WorkerTraineeSchema.index({ outcome: 1 });
WorkerTraineeSchema.index({ assignedUnit: 1 });
WorkerTraineeSchema.index({ assignedDistrict: 1 });

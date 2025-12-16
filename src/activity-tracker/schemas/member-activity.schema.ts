import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  TransitionFrom,
  TransitionTo,
  TravelStatus,
} from '../../common/enums/activity-tracker.enum';

export type MemberActivityDocument = MemberActivity &
  Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'member_activities',
})
export class MemberActivity {
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  member: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ActivityType),
    required: true,
  })
  activityType: ActivityType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(ActivityStatus),
    default: ActivityStatus.ACTIVE,
  })
  status: ActivityStatus;

  @Prop({
    type: String,
    enum: Object.values(ActivityPriority),
    default: ActivityPriority.MEDIUM,
  })
  priority: ActivityPriority;

  @Prop({ type: Date, default: Date.now })
  activityDate: Date;

  @Prop({ type: Date })
  effectiveDate?: Date; // When the change takes effect

  @Prop({ type: Date })
  expiryDate?: Date; // For temporary changes

  // Role/Position transition tracking
  @Prop({
    type: String,
    enum: Object.values(TransitionFrom),
  })
  fromRole?: TransitionFrom;

  @Prop({
    type: String,
    enum: Object.values(TransitionTo),
  })
  toRole?: TransitionTo;

  @Prop({ type: String })
  previousPosition?: string;

  @Prop({ type: String })
  newPosition?: string;

  // Unit/Group movement tracking
  @Prop({ type: Types.ObjectId, ref: 'Group' })
  fromUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  toUnit?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  fromDistrict?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  toDistrict?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  fromMinistries?: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  toMinistries?: Types.ObjectId[];

  // Travel and location tracking
  @Prop({
    type: String,
    enum: Object.values(TravelStatus),
  })
  travelStatus?: TravelStatus;

  @Prop({ type: String })
  previousLocation?: string;

  @Prop({ type: String })
  newLocation?: string;

  @Prop({ type: String })
  travelReason?: string;

  @Prop({ type: Date })
  expectedReturnDate?: Date;

  @Prop({ type: String })
  contactInformation?: string;

  @Prop({ type: Boolean, default: false })
  isTemporary: boolean;

  // Training and development tracking
  @Prop({ type: Types.ObjectId, ref: 'Cohort' })
  relatedCohort?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkerTrainee' })
  relatedTraining?: Types.ObjectId;

  @Prop({ type: String })
  trainingOutcome?: string;

  @Prop({ type: String })
  certification?: string;

  // Previous values for change tracking
  @Prop({ type: Object })
  previousValues?: Record<string, any>;

  @Prop({ type: Object })
  newValues?: Record<string, any>;

  // Administrative details
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  initiatedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvalDate?: Date;

  @Prop({ type: String })
  approvalNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  supervisedBy?: Types.ObjectId;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: String })
  justification?: string;

  @Prop([String])
  supportingDocuments?: string[];

  // Follow-up and monitoring
  @Prop([
    {
      date: { type: Date, required: true },
      by: { type: Types.ObjectId, ref: 'Member', required: true },
      notes: { type: String, required: true },
      nextFollowUp: Date,
    },
  ])
  followUpNotes: Array<{
    date: Date;
    by: Types.ObjectId;
    notes: string;
    nextFollowUp?: Date;
  }>;

  @Prop({ type: Date })
  nextFollowUpDate?: Date;

  @Prop({ type: Boolean, default: false })
  requiresFollowUp: boolean;

  // Impact tracking
  @Prop({
    type: {
      membershipStatus: String,
      leadershipLevel: Number,
      engagementScore: Number,
      attendanceImpact: Number,
      ministryInvolvement: Number,
    },
  })
  impactAssessment?: {
    membershipStatus?: string;
    leadershipLevel?: number;
    engagementScore?: number;
    attendanceImpact?: number;
    ministryInvolvement?: number;
  };

  // Related activities (for activity chains)
  @Prop([{ type: Types.ObjectId, ref: 'MemberActivity' }])
  relatedActivities?: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'MemberActivity' })
  parentActivity?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isSystemGenerated: boolean;

  @Prop({ type: Object })
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    source?: string;
    requestId?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: [number, number];
    };
  };

  @Prop([String])
  tags?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Boolean, default: true })
  isVisible: boolean; // For privacy control

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const MemberActivitySchema =
  SchemaFactory.createForClass(MemberActivity);

// Indexes for better query performance
MemberActivitySchema.index({ member: 1, activityDate: -1 });
MemberActivitySchema.index({ activityType: 1, activityDate: -1 });
MemberActivitySchema.index({ member: 1, activityType: 1 });
MemberActivitySchema.index({ status: 1, activityDate: -1 });
MemberActivitySchema.index({ priority: 1, activityDate: -1 });
MemberActivitySchema.index({ initiatedBy: 1, activityDate: -1 });
MemberActivitySchema.index({ approvedBy: 1, approvalDate: -1 });
MemberActivitySchema.index({ fromUnit: 1, toUnit: 1 });
MemberActivitySchema.index({ fromDistrict: 1, toDistrict: 1 });
MemberActivitySchema.index({ travelStatus: 1 });
MemberActivitySchema.index({ relatedCohort: 1 });
MemberActivitySchema.index({ relatedTraining: 1 });
MemberActivitySchema.index({ effectiveDate: 1 });
MemberActivitySchema.index({ expiryDate: 1 });
MemberActivitySchema.index({ nextFollowUpDate: 1 });
MemberActivitySchema.index({ isVisible: 1, activityDate: -1 });

// Compound indexes for common queries
MemberActivitySchema.index({ member: 1, status: 1, activityDate: -1 });
MemberActivitySchema.index({ activityType: 1, status: 1, activityDate: -1 });
MemberActivitySchema.index({ member: 1, activityType: 1, status: 1 });

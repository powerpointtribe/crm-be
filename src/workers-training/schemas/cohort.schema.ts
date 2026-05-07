import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  CohortType,
  CohortStatus,
} from '../../common/enums/workers-training.enum';

export type CohortDocument = Cohort & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'cohorts',
})
export class Cohort {
  @Prop({ type: Types.ObjectId, ref: 'Branch', index: true })
  branch?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  code: string; // e.g., DC2024-01, LXL2024-FOUNDATION-01

  @Prop({
    type: String,
    enum: Object.values(CohortType),
    required: true,
  })
  type: CohortType;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(CohortStatus),
    default: CohortStatus.PLANNING,
  })
  status: CohortStatus;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Date })
  registrationStartDate?: Date;

  @Prop({ type: Date })
  registrationEndDate?: Date;

  @Prop({ type: Number, default: 0 })
  maxParticipants: number;

  @Prop({ type: Number, default: 0 })
  currentParticipants: number;

  @Prop({ type: Number, default: 0 })
  minimumAttendance: number; // Percentage required for completion

  @Prop({ type: Number, default: 0 })
  passingGrade: number; // Minimum grade for completion

  // Facilitators and coordinators
  @Prop([{ type: Types.ObjectId, ref: 'Member' }])
  facilitators: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  coordinator?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  supervisor?: Types.ObjectId;

  // Location and logistics
  @Prop({ type: String })
  venue?: string;

  @Prop({
    type: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'Nigeria' },
    },
  })
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
  };

  @Prop({ type: String })
  meetingDays?: string; // e.g., "Saturdays", "Tuesdays & Thursdays"

  @Prop({ type: String })
  meetingTime?: string; // e.g., "10:00 AM - 12:00 PM"

  // Curriculum and requirements
  @Prop([
    {
      title: { type: String, required: true },
      description: String,
      duration: Number, // in hours
      materials: [String],
      facilitator: { type: Types.ObjectId, ref: 'Member' },
      isOptional: { type: Boolean, default: false },
    },
  ])
  modules: Array<{
    title: string;
    description?: string;
    duration: number;
    materials?: string[];
    facilitator?: Types.ObjectId;
    isOptional: boolean;
  }>;

  @Prop([
    {
      title: { type: String, required: true },
      description: String,
      dueDate: Date,
      maxScore: { type: Number, default: 100 },
      weight: { type: Number, default: 1 },
      isRequired: { type: Boolean, default: true },
    },
  ])
  assignments: Array<{
    title: string;
    description?: string;
    dueDate: Date;
    maxScore: number;
    weight: number;
    isRequired: boolean;
  }>;

  // Prerequisites and outcomes
  @Prop([String])
  prerequisites?: string[];

  @Prop([String])
  expectedOutcomes?: string[];

  @Prop([String])
  certifications?: string[];

  // Progression tracking
  @Prop({
    type: {
      totalSessions: { type: Number, default: 0 },
      completedSessions: { type: Number, default: 0 },
      averageAttendance: { type: Number, default: 0 },
      averageGrade: { type: Number, default: 0 },
      graduationRate: { type: Number, default: 0 },
    },
    default: {},
  })
  statistics: {
    totalSessions: number;
    completedSessions: number;
    averageAttendance: number;
    averageGrade: number;
    graduationRate: number;
  };

  // Administrative
  @Prop({ type: Number, default: 0 })
  cost?: number;

  @Prop({ type: String, default: 'NGN' })
  currency?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop([String])
  tags?: string[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  updatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const CohortSchema = SchemaFactory.createForClass(Cohort);

// Indexes for better query performance
CohortSchema.index({ code: 1 });
CohortSchema.index({ type: 1, status: 1 });
CohortSchema.index({ startDate: 1, endDate: 1 });
CohortSchema.index({ status: 1, startDate: 1 });
CohortSchema.index({ facilitators: 1 });
CohortSchema.index({ coordinator: 1 });
CohortSchema.index({ isActive: 1 });
CohortSchema.index({ name: 'text', description: 'text' });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EngagementStatus } from '../../common/enums/engagement-status.enum';

export type FirstTimerDocument = FirstTimer & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class FirstTimer {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({
    type: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'Nigeria' },
    },
  })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };

  @Prop({ type: Date, required: true })
  dateOfVisit: Date;

  @Prop({ trim: true })
  invitedBy?: string;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  invitedByMember?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(EngagementStatus),
    default: EngagementStatus.NEW,
  })
  status: EngagementStatus;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  giaLeader?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  followUpPerson?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  interestedInJoining: boolean;

  // Follow-up tracking
  @Prop([
    {
      type: {
        date: { type: Date, required: true },
        method: {
          type: String,
          enum: ['phone', 'email', 'sms', 'whatsapp', 'visit', 'video_call'],
          required: true,
        },
        notes: String,
        outcome: {
          type: String,
          enum: [
            'successful',
            'no_answer',
            'busy',
            'not_interested',
            'interested',
            'follow_up_needed',
          ],
          required: true,
        },
        contactedBy: { type: Types.ObjectId, ref: 'Member', required: true },
        nextFollowUpDate: Date,
      },
    },
  ])
  followUps: Array<{
    date: Date;
    method: string;
    notes?: string;
    outcome: string;
    contactedBy: Types.ObjectId;
    nextFollowUpDate?: Date;
  }>;

  // Visit information
  @Prop({
    type: String,
    enum: [
      'friend',
      'family',
      'advertisement',
      'online',
      'event',
      'walkby',
      'other',
    ],
  })
  howDidYouHear?: string;

  @Prop({ trim: true })
  previousChurch?: string;

  @Prop({
    type: String,
    enum: ['first_time', 'returning', 'new_to_area', 'church_shopping'],
  })
  visitorType?: string;

  // Family information
  @Prop({
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed'],
  })
  maritalStatus?: string;

  @Prop({ type: Number, min: 0 })
  numberOfChildren?: number;

  @Prop([
    {
      type: {
        name: String,
        age: Number,
        relationship: String,
      },
    },
  ])
  familyMembers: Array<{
    name: string;
    age?: number;
    relationship: string;
  }>;

  // Interests and needs
  @Prop([String])
  interests: string[];

  @Prop([String])
  prayerRequests: string[];

  @Prop([String])
  servingInterests: string[];

  @Prop({ trim: true })
  notes?: string;

  // Conversion tracking
  @Prop({ default: false })
  converted: boolean;

  @Prop({ type: Date })
  conversionDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  memberRecord?: Types.ObjectId;

  // Auto-assignment for districts
  @Prop({ type: Types.ObjectId, ref: 'Group' })
  suggestedDistrict?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  pendingDistrictAssignment: boolean;

  @Prop({ type: Date })
  memberCreatedAt?: Date;

  @Prop({ type: Date })
  lastStatusChange?: Date;

  @Prop({ type: Number, default: 0 })
  remindersSent: number;

  @Prop({ type: Date })
  lastReminderSent?: Date;

  // Follow-up scheduling
  @Prop({ type: Date })
  nextFollowUpDate?: Date;

  @Prop({ type: Number, default: 0 })
  followUpCount: number;

  @Prop({ default: true })
  isActive: boolean;

  // Duplicate tracking
  @Prop({ type: Boolean, default: false })
  hasDuplicatePhone: boolean;

  @Prop({ type: Boolean, default: false })
  hasDuplicateEmail: boolean;

  @Prop([String])
  duplicatePhoneNotes: string[];

  @Prop([String])
  duplicateEmailNotes: string[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const FirstTimerSchema = SchemaFactory.createForClass(FirstTimer);

// Indexes for better performance
FirstTimerSchema.index({ phone: 1 });
FirstTimerSchema.index({ email: 1 });
FirstTimerSchema.index({ status: 1 });
FirstTimerSchema.index({ dateOfVisit: -1 });
FirstTimerSchema.index({ assignedTo: 1 });
FirstTimerSchema.index({ nextFollowUpDate: 1 });
FirstTimerSchema.index({ converted: 1 });
FirstTimerSchema.index({ giaLeader: 1 });
FirstTimerSchema.index({ followUpPerson: 1 });
FirstTimerSchema.index({ pendingDistrictAssignment: 1 });
FirstTimerSchema.index({ interestedInJoining: 1 });
FirstTimerSchema.index({ lastStatusChange: -1 });

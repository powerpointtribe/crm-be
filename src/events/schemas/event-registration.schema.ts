import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventRegistrationDocument = EventRegistration &
  Document & { _id: Types.ObjectId };

// Registration status
export enum RegistrationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  WAITLISTED = 'waitlisted',
  CANCELLED = 'cancelled',
  ATTENDED = 'attended',
  NO_SHOW = 'no-show',
}

// Attendee type
export enum AttendeeType {
  MEMBER = 'member',
  VISITOR = 'visitor',
}

// Registration track
export enum RegistrationTrack {
  PROFESSIONAL = 'Professional',
  ENTREPRENEUR = 'Entrepreneur',
}

// Check-in code prefix
export enum CheckInCodePrefix {
  PROFESSIONAL = 'PRO',
  ENTREPRENEUR = 'ENT',
}

// Attendee information type
export interface AttendeeInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EventRegistration {
  // Event and Branch References
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  // Member Reference (optional for visitors)
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  member?: Types.ObjectId;

  // Attendee Type
  @Prop({
    type: String,
    enum: Object.values(AttendeeType),
    required: true,
    default: AttendeeType.VISITOR,
  })
  attendeeType: AttendeeType;

  // Attendee Information
  @Prop({
    type: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      gender: { type: String, enum: ['male', 'female'] },
    },
    required: true,
  })
  attendeeInfo: AttendeeInfo;

  // Registration Status
  @Prop({
    type: String,
    enum: Object.values(RegistrationStatus),
    default: RegistrationStatus.PENDING,
  })
  status: RegistrationStatus;

  // Custom Field Responses
  @Prop({ type: Map, of: String, default: {} })
  customFieldResponses: Map<string, string>;

  // Check-in Code (for QR code check-in)
  @Prop({ sparse: true, trim: true })
  checkInCode?: string;

  // Legacy check-in code (preserved from old PRO-/ENT- format)
  @Prop({ trim: true })
  legacyCheckInCode?: string;

  // Important Dates
  @Prop({ type: Date, default: Date.now })
  registeredAt: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: Date })
  checkedInAt?: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  // Notes
  @Prop({ trim: true })
  notes?: string;

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const EventRegistrationSchema =
  SchemaFactory.createForClass(EventRegistration);

// Add indexes for better performance
EventRegistrationSchema.index({ event: 1 });
EventRegistrationSchema.index({ branch: 1 });
EventRegistrationSchema.index({ member: 1 });
EventRegistrationSchema.index({ status: 1 });
EventRegistrationSchema.index({ event: 1, checkInCode: 1 }, { unique: true });
EventRegistrationSchema.index({ 'attendeeInfo.email': 1 });
EventRegistrationSchema.index({ 'attendeeInfo.phone': 1 });
EventRegistrationSchema.index({ event: 1, status: 1 });
EventRegistrationSchema.index(
  { event: 1, member: 1 },
  { unique: true, partialFilterExpression: { member: { $type: 'objectId' } } },
);
EventRegistrationSchema.index({ registeredAt: -1 });

// Pre-save hook to generate sequential check-in code (LBS-XXX)
EventRegistrationSchema.pre('save', async function (next) {
  if (!this.checkInCode) {
    const Model = this.constructor as any;

    // Find the highest existing LBS- code number for this event
    const lastReg = await Model.findOne({
      event: this.event,
      checkInCode: new RegExp(`^LBS-\\d+$`),
    })
      .sort({ checkInCode: -1 })
      .select('checkInCode')
      .lean();

    let nextNum = 1;
    if (lastReg?.checkInCode) {
      const match = lastReg.checkInCode.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    this.checkInCode = `LBS-${String(nextNum).padStart(3, '0')}`;
  }
  next();
});

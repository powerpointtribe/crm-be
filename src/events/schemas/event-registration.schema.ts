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
  @Prop({ unique: true, sparse: true, trim: true })
  checkInCode?: string;

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
EventRegistrationSchema.index({ checkInCode: 1 });
EventRegistrationSchema.index({ 'attendeeInfo.email': 1 });
EventRegistrationSchema.index({ 'attendeeInfo.phone': 1 });
EventRegistrationSchema.index({ event: 1, status: 1 });
EventRegistrationSchema.index({ event: 1, member: 1 }, { unique: true, sparse: true });
EventRegistrationSchema.index({ registeredAt: -1 });

// Pre-save hook to generate check-in code if not present
EventRegistrationSchema.pre('save', function (next) {
  if (!this.checkInCode) {
    // Generate a unique check-in code
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.checkInCode = `${timestamp}-${randomPart}`;
  }
  next();
});

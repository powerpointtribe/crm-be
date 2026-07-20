import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as crypto from 'crypto';

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

  // Optional: global events (isGlobal: true) are not scoped to a branch.
  // For branch-scoped events this is populated from event.branch at registration time.
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branch?: Types.ObjectId;

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

  // Application token — a unique, unguessable token used to build a public,
  // per-registrant application form link (e.g. {baseUrl}/apply/{token}).
  // Generated automatically on first save.
  @Prop({ unique: true, sparse: true, trim: true })
  applicationToken?: string;

  // Set when the registrant submits the full application form via their link.
  @Prop({ type: Date })
  applicationSubmittedAt?: Date;

  // Tracks the "finish your application" reminder emails sent to registrants
  // who haven't submitted yet. Drives the recurring reminder scheduler.
  @Prop({ type: Date })
  applicationReminderSentAt?: Date;

  @Prop({ type: Number, default: 0 })
  applicationReminderCount?: number;

  // Unique CMIT student ID, assigned when the admission letter is issued
  // (e.g. "CMIT/C1/0007"). Shown on the admission letter and for support.
  @Prop({ trim: true })
  studentId?: string;

  // Set when the admission letter PDF has been emailed (guards re-sends).
  @Prop({ type: Date })
  admissionLetterSentAt?: Date;

  // Admission decision — separate from `status` (registration lifecycle).
  // Gates LMS portal access: only 'accepted' registrants get a login invite.
  @Prop({
    type: String,
    enum: ['applied', 'accepted', 'rejected', 'waitlisted'],
    default: 'applied',
  })
  admissionStatus: string;

  @Prop({ type: Date })
  acceptedAt?: Date;

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

EventRegistrationSchema.pre('save', async function (next) {
  // Generate a unique application token for the per-registrant form link.
  if (!this.applicationToken) {
    this.applicationToken = crypto.randomBytes(24).toString('hex');
  }

  if (!this.checkInCode) {
    const Model = this.constructor as any;

    let prefix = 'LBS';
    try {
      const eventDoc: any = await this.model('Event').findById(this.event).select('checkInCodePrefix').lean();
      if (eventDoc?.checkInCodePrefix) prefix = eventDoc.checkInCodePrefix;
    } catch {}

    // Highest existing number for this prefix — computed NUMERICALLY. A plain
    // `.sort({ checkInCode: -1 })` is lexicographic, so once codes pass 999 it
    // wrongly ranks "PREFIX-999" above "PREFIX-1000" and regenerates an
    // existing code, violating the unique {event, checkInCode} index (500).
    const codes: Array<{ checkInCode?: string }> = await Model.find({
      event: this.event,
      checkInCode: new RegExp(`^${prefix}-\\d+$`),
    })
      .select('checkInCode')
      .lean();

    let maxNum = 0;
    for (const r of codes) {
      const m = r.checkInCode?.match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }

    // Walk forward to the first free code (guards against races / gaps).
    let nextNum = maxNum + 1;
    for (let i = 0; i < 100 && !this.checkInCode; i++) {
      const candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
      const exists = await Model.exists({
        event: this.event,
        checkInCode: candidate,
      });
      if (!exists) {
        this.checkInCode = candidate;
      } else {
        nextNum += 1;
      }
    }
    if (!this.checkInCode) {
      this.checkInCode = `${prefix}-${String(nextNum).padStart(3, '0')}-${crypto.randomBytes(2).toString('hex')}`;
    }
  }
  next();
});

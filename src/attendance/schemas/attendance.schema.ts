import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

export enum ServiceType {
  SUNDAY_FIRST_SERVICE = 'sunday_first_service',
  SUNDAY_SECOND_SERVICE = 'sunday_second_service',
  MIDWEEK_SERVICE = 'midweek_service',
  PRAYER_MEETING = 'prayer_meeting',
  BIBLE_STUDY = 'bible_study',
  YOUTH_SERVICE = 'youth_service',
  CHILDREN_SERVICE = 'children_service',
  SPECIAL_EVENT = 'special_event',
  UNIT_MEETING = 'unit_meeting',
  MINISTRY_MEETING = 'ministry_meeting',
  OTHER = 'other',
}

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  member: Types.ObjectId;

  @Prop({ type: Date, required: true })
  serviceDate: Date;

  @Prop({
    type: String,
    enum: Object.values(ServiceType),
    required: true,
  })
  serviceType: ServiceType;

  @Prop({
    type: String,
    enum: Object.values(AttendanceStatus),
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Prop({ type: Types.ObjectId, ref: 'Ministry' })
  ministry?: Types.ObjectId; // For ministry-specific meetings

  @Prop({ type: Types.ObjectId, ref: 'Unit' })
  unit?: Types.ObjectId; // For unit-specific meetings

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy: Types.ObjectId; // Who recorded this attendance

  @Prop({ type: Date })
  checkInTime?: Date; // When they actually arrived

  @Prop({ type: Date })
  checkOutTime?: Date; // When they left (optional)

  @Prop({ trim: true })
  notes?: string; // Additional notes about attendance

  @Prop({ trim: true })
  serviceName?: string; // Custom service name if serviceType is 'other'

  @Prop({ trim: true })
  location?: string; // Where the service/meeting was held

  // Tracking fields
  @Prop({ default: false })
  isFirstTimeAttendee: boolean; // Mark if this is their first time attending this service type

  @Prop({ default: false })
  isVisitor: boolean; // Mark if this person is a visitor (not a regular member)

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId; // If visitor, who invited them

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Add indexes for better performance
AttendanceSchema.index({ member: 1, serviceDate: -1 });
AttendanceSchema.index({ serviceDate: -1 });
AttendanceSchema.index({ serviceType: 1, serviceDate: -1 });
AttendanceSchema.index({ ministry: 1, serviceDate: -1 });
AttendanceSchema.index({ unit: 1, serviceDate: -1 });
AttendanceSchema.index({ status: 1 });
AttendanceSchema.index({ recordedBy: 1 });
AttendanceSchema.index({ isFirstTimeAttendee: 1 });
AttendanceSchema.index({ isVisitor: 1 });
AttendanceSchema.index({ createdAt: -1 });

// Compound indexes for common queries
AttendanceSchema.index({ member: 1, serviceType: 1, serviceDate: -1 });
AttendanceSchema.index({ serviceDate: 1, serviceType: 1, status: 1 });
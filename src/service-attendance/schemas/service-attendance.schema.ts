import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServiceAttendanceDocument = ServiceAttendance & Document;

export enum ServiceType {
  SUNDAY_SERVICE = 'sunday_service',
  BIBLE_STUDY = 'bible_study',
  WORKERS_MEETING = 'workers_meeting',
  SPECIAL_EVENT = 'special_event',
  SUNDAY_FIRST_SERVICE = 'sunday_first_service',
  SUNDAY_SECOND_SERVICE = 'sunday_second_service',
  MIDWEEK_SERVICE = 'midweek_service',
  FRIDAY_VIGIL = 'friday_vigil',
  SPECIAL_SERVICE = 'special_service',
  YOUTH_SERVICE = 'youth_service',
  CHILDREN_SERVICE = 'children_service',
  DISTRICT_MEETING = 'district_meeting',
  UNIT_MEETING = 'unit_meeting',
  OTHER = 'other',
}

export enum CheckInMethod {
  QR = 'qr',
  MANUAL = 'manual',
  APP = 'app',
  IMPORT = 'import',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
}

@Schema({ timestamps: true, versionKey: false })
export class ServiceAttendance {
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true, index: true })
  member: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, index: true })
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

  @Prop({
    type: String,
    enum: Object.values(CheckInMethod),
    default: CheckInMethod.MANUAL,
  })
  checkInMethod: CheckInMethod;

  @Prop({ type: Date })
  checkInTime?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  checkedInBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceReport' })
  serviceReport?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', index: true })
  group?: Types.ObjectId;

  @Prop({ trim: true })
  serviceTitle?: string;

  @Prop({ trim: true })
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceAttendanceSchema =
  SchemaFactory.createForClass(ServiceAttendance);

ServiceAttendanceSchema.index(
  { member: 1, serviceDate: 1, serviceType: 1 },
  { unique: true },
);
ServiceAttendanceSchema.index({ serviceDate: -1, branch: 1 });
ServiceAttendanceSchema.index({ member: 1, serviceDate: -1 });
ServiceAttendanceSchema.index({ checkedInBy: 1 });

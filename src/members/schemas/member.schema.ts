import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MembershipStatus } from '../../common/enums/member-status.enum';
import { UserRole } from '../../common/enums/user-roles.enums';
import { UnitType } from '../../common/enums/dashboard-modules.enums';

export type MemberDocument = Member & Document & { _id: Types.ObjectId };

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Member {
  // BASIC INFORMATION
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({
    type: String,
    enum: ['male', 'female'],
    required: true,
  })
  gender: string;

  @Prop({
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed'],
    default: 'single',
  })
  maritalStatus: string;

  // AUTHENTICATION FIELDS (moved from User schema)

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  lastLogin?: Date;

  // CHURCH MEMBERSHIP STATUS
  @Prop({
    type: String,
    enum: Object.values(MembershipStatus),
    default: MembershipStatus.NEW_CONVERT,
  })
  membershipStatus: MembershipStatus;

  // SYSTEM ROLES & ACCESS CONTROL
  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.MEMBER],
  })
  systemRoles: UserRole[];

  // ADDRESS INFORMATION
  @Prop({
    type: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: 'Lagos' },
      zipCode: String,
      country: { type: String, default: 'Nigeria' },
    },
    default: {
      street: '',
      city: '',
      state: 'Lagos',
      country: 'Nigeria',
    },
  })
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode?: string;
    country: string;
  };

  // CHURCH DATES
  @Prop({ type: Date, default: Date.now })
  dateJoined: Date;

  @Prop({ type: Date })
  baptismDate?: Date;

  @Prop({ type: Date })
  confirmationDate?: Date;

  // CHURCH STRUCTURE - District and Unit Assignments
  @Prop({
    type: Types.ObjectId,
    ref: 'Group',
  })
  district?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Group',
  })
  unit?: Types.ObjectId;

  // Unit type for access control (GIA, DISTRICT, MINISTRY_UNIT, LEADERSHIP_UNIT)
  @Prop({
    type: String,
    enum: Object.values(UnitType),
  })
  unitType?: UnitType;

  // Additional group memberships (fellowships, ministries, committees)
  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  additionalGroups: Types.ObjectId[];

  // LEADERSHIP ROLES TRACKING (with access control implications)
  @Prop({
    type: {
      isDistrictPastor: { type: Boolean, default: false },
      isChamp: { type: Boolean, default: false },
      isUnitHead: { type: Boolean, default: false },
      champForDistrict: { type: Types.ObjectId, ref: 'Group' },
      leadsUnit: { type: Types.ObjectId, ref: 'Group' },
      pastorsDistrict: { type: Types.ObjectId, ref: 'Group' },
    },
    default: {
      isDistrictPastor: false,
      isChamp: false,
      isUnitHead: false,
    },
  })
  leadershipRoles: {
    isDistrictPastor: boolean;
    isChamp: boolean;
    isUnitHead: boolean;
    champForDistrict?: Types.ObjectId;
    leadsUnit?: Types.ObjectId;
    pastorsDistrict?: Types.ObjectId;
  };

  // MINISTRY INVOLVEMENT (for access control)
  @Prop([String])
  ministries: string[];

  @Prop([String])
  skills: string[];

  @Prop({ trim: true })
  occupation?: string;

  @Prop({ trim: true })
  workAddress?: string;

  // Ministry leadership for directors (moved from User schema)
  @Prop({ type: [Types.ObjectId], ref: 'Ministry' })
  directorOfMinistries?: Types.ObjectId[];

  // FAMILY RELATIONSHIPS
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  spouse?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Member' }])
  children: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  parent?: Types.ObjectId;

  // EMERGENCY CONTACT
  @Prop({
    type: {
      name: String,
      relationship: String,
      phone: String,
      email: String,
    },
  })
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };

  // SPIRITUAL JOURNEY TRACKING
  @Prop({
    type: {
      foundationClass: {
        completed: { type: Boolean, default: false },
        completionDate: Date,
      },
      baptismClass: {
        completed: { type: Boolean, default: false },
        completionDate: Date,
      },
      membershipClass: {
        completed: { type: Boolean, default: false },
        completionDate: Date,
      },
      leadershipClass: {
        completed: { type: Boolean, default: false },
        completionDate: Date,
      },
    },
    default: {
      foundationClass: { completed: false },
      baptismClass: { completed: false },
      membershipClass: { completed: false },
      leadershipClass: { completed: false },
    },
  })
  spiritualJourney: {
    foundationClass: { completed: boolean; completionDate?: Date };
    baptismClass: { completed: boolean; completionDate?: Date };
    membershipClass: { completed: boolean; completionDate?: Date };
    leadershipClass: { completed: boolean; completionDate?: Date };
  };

  @Prop({ trim: true })
  profilePicture?: string;

  @Prop({ trim: true })
  notes?: string;

  // ENGAGEMENT TRACKING
  @Prop({
    type: {
      lastAttendance: Date,
      attendanceCount: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
    },
    default: {
      attendanceCount: 0,
      engagementScore: 0,
    },
  })
  engagement: {
    lastAttendance?: Date;
    attendanceCount: number;
    engagementScore: number;
  };

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

// Add virtual methods for access control
MemberSchema.methods.canAccessModule = function (module: string): boolean {
  // This will be implemented in the service layer using the access control logic
  return true; // Placeholder
};

MemberSchema.methods.hasPermission = function (permission: string): boolean {
  // Check system roles, leadership roles, unit type, etc.
  return true; // Placeholder
};

MemberSchema.methods.getAccessibleModules = function (): string[] {
  // Return array of accessible modules based on roles and assignments
  return []; // Placeholder
};

// Add indexes for better performance
MemberSchema.index({ email: 1 });
MemberSchema.index({ phone: 1 });
MemberSchema.index({ systemRoles: 1 });
MemberSchema.index({ membershipStatus: 1 });
MemberSchema.index({ dateJoined: -1 });
MemberSchema.index({ firstName: 1, lastName: 1 });
MemberSchema.index({ district: 1 });
MemberSchema.index({ unit: 1 });
MemberSchema.index({ unitType: 1 });
MemberSchema.index({ 'leadershipRoles.isDistrictPastor': 1 });
MemberSchema.index({ 'leadershipRoles.isChamp': 1 });
MemberSchema.index({ 'leadershipRoles.isUnitHead': 1 });
MemberSchema.index({ directorOfMinistries: 1 });
MemberSchema.index({ lastLogin: -1 });
MemberSchema.index({ isActive: 1 });

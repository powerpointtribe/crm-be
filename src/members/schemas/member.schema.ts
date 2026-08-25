import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MembershipStatus } from '../../common/enums/member-status.enum';
import { UserRole } from '../../common/enums/user-roles.enums';
import { UnitType } from '../../common/enums/dashboard-modules.enums';
import { AccountType } from '../../common/enums/account-type.enum';

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

  @Prop({ trim: true })
  phone: string;

  @Prop({ type: Date })
  dateOfBirth: Date;

  @Prop({
    type: String,
    enum: ['male', 'female'],
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

  @Prop({
    type: String,
    enum: Object.values(AccountType),
    default: AccountType.MEMBER,
  })
  accountType: AccountType;

  @Prop({ type: Date })
  lastLogin?: Date;

  // PASSWORD RESET FIELDS
  @Prop({ type: String })
  resetPasswordOtp?: string;

  @Prop({ type: Date })
  resetPasswordOtpExpires?: Date;

  @Prop({ type: Boolean, default: false })
  mustChangePassword: boolean;

  // CHURCH MEMBERSHIP STATUS (hierarchical status: MEMBER, DC, LXL, DIRECTOR, PASTOR, SENIOR_PASTOR)
  // This is different from EngagementStatus used in First Timers module
  @Prop({
    type: String,
    enum: Object.values(MembershipStatus),
    default: MembershipStatus.MEMBER,
    required: true,
  })
  membershipStatus: MembershipStatus;

  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.MEMBER],
  })
  systemRoles: UserRole[];

  // ROLE-BASED ACCESS CONTROL
  // Primary role assignment
  @Prop({ type: Types.ObjectId, ref: 'Role', required: false, default: null })
  role: Types.ObjectId | null;

  // Additional roles — permissions are merged with primary role
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Role' }], default: [] })
  additionalRoles: Types.ObjectId[];

  // Scoped event access — when non-empty, limits events:view to only these events
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Event' }], default: [] })
  scopedEventIds!: Types.ObjectId[];

  // Scoped store product access — when non-empty, limits store:view-products to only these products
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  scopedProductIds!: Types.ObjectId[];

  // ADDRESS INFORMATION
  @Prop({
    type: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, required: true, default: 'Lagos' },
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
  address: {
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

  // CHURCH STRUCTURE - Branch, District and Unit Assignments
  // Branch assignment is required for all members
  @Prop({
    type: Types.ObjectId,
    ref: 'Branch',
    required: true,
  })
  branch: Types.ObjectId;

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

  // For Assistant Pastors: districts they are assigned to manage within their branch
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Group' }],
    default: [],
  })
  assignedDistricts: Types.ObjectId[];

  // Unit type for access control (GIA, DISTRICT, MINISTRY_UNIT, LEADERSHIP_UNIT)
  @Prop({
    type: String,
    enum: Object.values(UnitType),
  })
  unitType?: UnitType;

  // Additional group memberships (fellowships, ministries, committees)
  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  additionalGroups: Types.ObjectId[];

  // MINISTRY INVOLVEMENT
  @Prop([String])
  ministries: string[];

  @Prop([String])
  skills: string[];

  @Prop({ trim: true })
  occupation?: string;

  @Prop({ trim: true })
  workAddress?: string;

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

  // USER PREFERENCES
  @Prop({
    type: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      language: { type: String, default: 'en' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
        followUpReminders: { type: Boolean, default: true },
        weeklyReports: { type: Boolean, default: false },
      },
      display: {
        compactMode: { type: Boolean, default: false },
        showWelcomeMessage: { type: Boolean, default: true },
      },
    },
    default: {
      theme: 'system',
      language: 'en',
      notifications: {
        email: true,
        sms: false,
        push: true,
        followUpReminders: true,
        weeklyReports: false,
      },
      display: {
        compactMode: false,
        showWelcomeMessage: true,
      },
    },
  })
  preferences: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      followUpReminders: boolean;
      weeklyReports: boolean;
    };
    display: {
      compactMode: boolean;
      showWelcomeMessage: boolean;
    };
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
MemberSchema.index({ role: 1 });
MemberSchema.index({ membershipStatus: 1 });
MemberSchema.index({ dateJoined: -1 });
MemberSchema.index({ firstName: 1, lastName: 1 });
MemberSchema.index({ branch: 1 }); // Branch index for RBAC filtering
MemberSchema.index({ branch: 1, district: 1 }); // Compound index for branch+district queries
MemberSchema.index({ district: 1 });
MemberSchema.index({ unit: 1 });
MemberSchema.index({ unitType: 1 });
MemberSchema.index({ assignedDistricts: 1 }); // For assistant pastor district assignments
MemberSchema.index({ lastLogin: -1 });
MemberSchema.index({ isActive: 1 });
MemberSchema.index({ accountType: 1 });

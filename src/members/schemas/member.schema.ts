import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MembershipStatus } from '../../common/enums/member-status.enum';

export type MemberDocument = Member & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Member {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

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

  @Prop({
    type: String,
    enum: Object.values(MembershipStatus),
    default: MembershipStatus.NEW_CONVERT,
  })
  membershipStatus: MembershipStatus;

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
    ref: 'Group', // OPTIONAL - but recommended
  })
  unit?: Types.ObjectId;

  // Additional group memberships (fellowships, ministries, committees)
  @Prop([{ type: Types.ObjectId, ref: 'Group' }])
  additionalGroups: Types.ObjectId[];

  // Leadership roles tracking
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

  // Ministry involvement
  @Prop([String])
  ministries: string[];

  @Prop([String])
  skills: string[];

  @Prop({ trim: true })
  occupation?: string;

  @Prop({ trim: true })
  workAddress?: string;

  // Family relationships
  @Prop({ type: Types.ObjectId, ref: 'Member' })
  spouse?: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'Member' }])
  children: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Member' })
  parent?: Types.ObjectId;

  // Emergency contact
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

  // Spiritual journey tracking
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

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ trim: true })
  profilePicture?: string;

  @Prop({ trim: true })
  notes?: string;

  // Engagement tracking
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

// Add indexes for better performance
MemberSchema.index({ email: 1 });
MemberSchema.index({ phone: 1 });
MemberSchema.index({ membershipStatus: 1 });
MemberSchema.index({ dateJoined: -1 });
MemberSchema.index({ firstName: 1, lastName: 1 });
MemberSchema.index({ district: 1 });
MemberSchema.index({ unit: 1 });
MemberSchema.index({ 'leadershipRoles.isDistrictPastor': 1 });
MemberSchema.index({ 'leadershipRoles.isChamp': 1 });
MemberSchema.index({ 'leadershipRoles.isUnitHead': 1 });

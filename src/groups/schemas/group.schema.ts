import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GroupType } from '../../common/enums/group-types.enum';

export type GroupDocument = Group & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Group {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(GroupType),
    required: true,
  })
  type: GroupType;

  @Prop({ trim: true })
  description?: string;

  // DISTRICT-SPECIFIC FIELDS
  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
  })
  districtPastor?: Types.ObjectId;

  // UNIT-SPECIFIC FIELDS
  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
  })
  unitHead?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
  })
  assistantUnitHead?: Types.ObjectId;

  // MINISTRY-SPECIFIC FIELDS
  @Prop({
    type: Types.ObjectId,
    ref: 'Member',
  })
  ministryDirector?: Types.ObjectId;

  // Linked units for ministry - members in these units auto-join the ministry
  @Prop([
    {
      type: Types.ObjectId,
      ref: 'Group',
    },
  ])
  linkedUnits: Types.ObjectId[];

  // DEFAULT ROLE - Auto-assigned when member joins group
  @Prop({
    type: Types.ObjectId,
    ref: 'Role',
  })
  defaultRole?: Types.ObjectId;

  // GENERAL FIELDS
  @Prop([{ type: Types.ObjectId, ref: 'Member' }])
  members: Types.ObjectId[];

  // Meeting information
  @Prop({
    type: {
      day: {
        type: String,
        enum: [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ],
      },
      time: String,
      location: String,
      isVirtual: { type: Boolean, default: false },
      virtualLink: String, // For online meetings (Zoom, Teams, etc.)
      address: {
        street: String,
        city: String,
        state: String,
        country: { type: String, default: 'Nigeria' },
      },
    },
  })
  meetingSchedule?: {
    day: string;
    time: string;
    location: string;
    isVirtual?: boolean;
    virtualLink?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      country: string;
    };
  };

  // District-specific meeting info (home cells often meet in homes)
  @Prop({
    type: {
      hostMember: { type: Types.ObjectId, ref: 'Member' },
      rotatingHosts: [{ type: Types.ObjectId, ref: 'Member' }],
      currentHost: { type: Types.ObjectId, ref: 'Member' },
    },
  })
  hostingInfo?: {
    hostMember?: Types.ObjectId;
    rotatingHosts: Types.ObjectId[];
    currentHost?: Types.ObjectId;
  };

  @Prop({ default: true })
  isActive: boolean;

  // Capacity tracking
  @Prop({ type: Number, default: 0 })
  maxCapacity?: number;

  @Prop({ type: Number, default: 0 })
  currentMemberCount: number;

  // Contact information
  @Prop({ trim: true })
  contactPhone?: string;

  @Prop({ trim: true, lowercase: true })
  contactEmail?: string;

  // Group goals and objectives
  @Prop({ trim: true })
  vision?: string;

  @Prop({ trim: true })
  mission?: string;

  @Prop([String])
  goals: string[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

// Add indexes for better performance
GroupSchema.index({ type: 1 });
GroupSchema.index({ districtPastor: 1 });
GroupSchema.index({ unitHead: 1 });
GroupSchema.index({ assistantUnitHead: 1 });
GroupSchema.index({ ministryDirector: 1 });
GroupSchema.index({ linkedUnits: 1 });
GroupSchema.index({ defaultRole: 1 });
GroupSchema.index({ members: 1 });
GroupSchema.index({ name: 1 });
GroupSchema.index({ isActive: 1 });

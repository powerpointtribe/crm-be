import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GisSnapshotDocument = GisSnapshot & Document;

@Schema({ timestamps: true, versionKey: false })
export class GisSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, index: true })
  snapshotDate: Date;

  @Prop({
    type: String,
    enum: ['weekly', 'monthly'],
    required: true,
  })
  period: string;

  @Prop({ type: Object, required: true })
  metrics: {
    totalActiveMembers: number;
    avgSundayAttendance: number;
    firstTimerCount: number;
    firstTimerConversionRate: number;
    retentionRate90Day: number;
    smallGroupParticipationRate: number;
    servingRate: number;
    newMembersThisMonth: number;
    inactiveMembers: number;
    baptismRate: number;
    leadershipPipelineCount: number;
    growthRate: number;
    avgEngagementScore: number;
    attritionCount: number;
    followUpRate: number;
  };

  @Prop({ type: Object })
  funnelCounts: {
    reach: number;
    visit: number;
    connect: number;
    belong: number;
    grow: number;
    serve: number;
    lead: number;
    multiply: number;
  };

  @Prop({ type: [Object] })
  districtBreakdowns: Array<{
    districtId: string;
    districtName: string;
    memberCount: number;
    avgAttendance: number;
    firstTimerCount: number;
    conversionRate: number;
    engagementScore: number;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

export const GisSnapshotSchema = SchemaFactory.createForClass(GisSnapshot);

GisSnapshotSchema.index(
  { branch: 1, snapshotDate: -1, period: 1 },
  { unique: true },
);

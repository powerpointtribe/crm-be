import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeaderboardEntryDocument = LeaderboardEntry &
  Document & { _id: Types.ObjectId };

/**
 * A precomputed leaderboard row for one learner, one scope. The board is
 * snapshotted (recomputed by cron + on facilitator demand) into this collection
 * so student reads are a cheap indexed sort rather than a live cross-collection
 * aggregation. `scope` is 'overall' (all-time) or 'weekly' (current Sun–Sat
 * window, Africa/Lagos). Names/studentId are denormalised for fast rendering.
 */
@Schema({ timestamps: true, versionKey: false })
export class LeaderboardEntry {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'EventRegistration',
    required: true,
    index: true,
  })
  registration: Types.ObjectId;

  @Prop({ type: String, enum: ['overall', 'weekly'], required: true })
  scope: string;

  // Start of the Sun–Sat window this weekly row belongs to (unset for overall).
  @Prop({ type: Date })
  weekStart?: Date;

  @Prop({ trim: true, default: '' })
  name: string;

  @Prop({ trim: true })
  studentId?: string;

  @Prop({ type: Number, default: 0 })
  points: number;

  // Component breakdown that sums (with streak) to `points`.
  @Prop({
    type: {
      lessons: { type: Number, default: 0 },
      modules: { type: Number, default: 0 },
      quizzes: { type: Number, default: 0 },
      summaries: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
    },
    default: {},
    _id: false,
  })
  breakdown: {
    lessons: number;
    modules: number;
    quizzes: number;
    summaries: number;
    streak: number;
  };

  @Prop({ type: Number, default: 0 })
  streakWeeks: number;

  // Count of fully-completed published modules (for the shareable card).
  @Prop({ type: Number, default: 0 })
  modulesCompleted: number;

  @Prop({ type: Number, default: 0 })
  rank: number;

  @Prop({ type: Date })
  lastActivityAt?: Date;

  @Prop({ type: Date })
  computedAt: Date;
}

export const LeaderboardEntrySchema =
  SchemaFactory.createForClass(LeaderboardEntry);
// Fast board read: one scope of one event, in rank order.
LeaderboardEntrySchema.index({ event: 1, scope: 1, rank: 1 });
// One row per learner per scope.
LeaderboardEntrySchema.index(
  { event: 1, registration: 1, scope: 1 },
  { unique: true },
);

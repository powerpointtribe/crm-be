import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LeaderboardWeightsDocument = LeaderboardWeights &
  Document & { _id: Types.ObjectId };

/**
 * Per-event, facilitator-tunable scoring weights for the learner leaderboard.
 * One doc per event; created lazily with the defaults below on first read.
 */
@Schema({ timestamps: true, versionKey: false })
export class LeaderboardWeights {
  @Prop({
    type: Types.ObjectId,
    ref: 'Event',
    required: true,
    unique: true,
    index: true,
  })
  event: Types.ObjectId;

  // Points per completed lesson.
  @Prop({ type: Number, default: 10 })
  perLesson: number;

  // Bonus for completing every countable lesson in a published module.
  @Prop({ type: Number, default: 25 })
  perModule: number;

  // Max points for a passed quiz (scaled by score %).
  @Prop({ type: Number, default: 20 })
  quizMax: number;

  // Max points for a graded sermon summary (scaled by facilitator grade /100).
  @Prop({ type: Number, default: 30 })
  summaryMax: number;

  // Bonus points per consecutive active week (overall board only).
  @Prop({ type: Number, default: 15 })
  streakBonusPerWeek: number;

  // Learner emails to keep off the board (test/staff accounts).
  @Prop({ type: [String], default: [] })
  excludedEmails: string[];

  // When true, the board is frozen — no recomputation from any source.
  @Prop({ type: Boolean, default: false })
  frozen: boolean;
}

export const LeaderboardWeightsSchema =
  SchemaFactory.createForClass(LeaderboardWeights);

import { SetMetadata } from '@nestjs/common';
import { ActivityType } from '../enums/activity-tracker.enum';

export interface LifecycleLogConfig {
  activityType: ActivityType;
  title: string;
  description?: string;
  extractMemberId?: (args: any[], result?: any) => string;
  extractEventData?: (args: any[], result?: any) => Record<string, any>;
  condition?: (args: any[], result?: any) => boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  requiresFollowUp?: boolean;
}

export const LOG_LIFECYCLE_KEY = 'logLifecycle';

export const LogLifecycle = (config: LifecycleLogConfig) =>
  SetMetadata(LOG_LIFECYCLE_KEY, config);
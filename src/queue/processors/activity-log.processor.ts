import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  ActivityLogJobData,
  JobType,
} from '../../common/interfaces/queue-job.interface';
import { MemberLifecycleService } from '../../activity-tracker/member-lifecycle.service';
import { ActivityType } from '../../common/enums/activity-tracker.enum';

@Injectable()
@Processor(QueueName.ACTIVITY_LOGS)
export class ActivityLogProcessor {
  private readonly logger = new Logger(ActivityLogProcessor.name);

  constructor(private memberLifecycleService: MemberLifecycleService) {
    this.logger.log('ActivityLogProcessor initialized');
  }

  @Process(JobType.LOG_GROUP_MEMBER_ADDITION)
  async handleGroupMemberAddition(job: Job<ActivityLogJobData>) {
    this.logger.log(
      `[handleGroupMemberAddition] Processing job ${job.id} for member: ${job.data.memberId}, data: ${JSON.stringify(job.data)}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      // Determine activity type based on group type
      let activityType = ActivityType.VOLUNTEER_ASSIGNMENT;
      let title = `Added to ${data.groupType || 'Group'}`;
      let description = `Added to ${data.groupName}`;

      if (data.groupType === 'UNIT') {
        // Check if this is first unit assignment (DC enrollment)
        if (data.isFirstAssignment) {
          activityType = ActivityType.DC_ENROLLMENT;
          title = 'DC Enrollment - Unit Assignment';
          description = `Enrolled as DC member and assigned to ${data.groupName}`;
        } else {
          activityType = ActivityType.UNIT_ASSIGNMENT;
          title = 'Unit Assignment';
          description = `Assigned to unit: ${data.groupName}`;
        }
      } else if (data.groupType === 'DISTRICT') {
        activityType = ActivityType.DISTRICT_ASSIGNMENT;
        title = 'District Assignment';
        description = `Assigned to district: ${data.groupName}`;
      } else if (data.groupType === 'MINISTRY') {
        activityType = ActivityType.MINISTRY_ASSIGNMENT;
        title = 'Ministry Assignment';
        description = `Joined ministry: ${data.groupName}`;
      }

      await this.memberLifecycleService.logLifecycleEvent({
        memberId,
        activityType,
        title,
        description,
        initiatedBy,
        reason: `Added to ${data.groupType?.toLowerCase() || 'group'}: ${data.groupName}`,
        toUnit: data.groupType === 'UNIT' ? data.groupId : undefined,
        toDistrict: data.groupType === 'DISTRICT' ? data.groupId : undefined,
        tags: [data.groupType?.toLowerCase() || 'group', 'assignment'],
      });

      this.logger.debug(
        `Group member addition logged for member: ${memberId} to ${data.groupName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log group member addition: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_GROUP_MEMBER_REMOVAL)
  async handleGroupMemberRemoval(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing group member removal log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      // Determine activity type based on group type
      let activityType = ActivityType.COMMITTEE_REMOVAL;
      if (data.groupType === 'UNIT') {
        activityType = ActivityType.UNIT_REMOVAL;
      } else if (data.groupType === 'DISTRICT') {
        activityType = ActivityType.DISTRICT_REMOVAL;
      } else if (data.groupType === 'MINISTRY') {
        activityType = ActivityType.MINISTRY_REMOVAL;
      }

      await this.memberLifecycleService.logLifecycleEvent({
        memberId,
        activityType,
        title: `Removed from ${data.groupType || 'Group'}`,
        description: `Removed from ${data.groupName}`,
        initiatedBy,
        reason: data.reason || `Removed from ${data.groupType?.toLowerCase() || 'group'}`,
        fromUnit: data.groupType === 'UNIT' ? data.groupId : undefined,
        fromDistrict: data.groupType === 'DISTRICT' ? data.groupId : undefined,
        tags: [data.groupType?.toLowerCase() || 'group', 'removal'],
      });

      this.logger.debug(
        `Group member removal logged for member: ${memberId} from ${data.groupName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log group member removal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_MEMBERSHIP_STATUS_CHANGE)
  async handleMembershipStatusChange(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing membership status change log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logMembershipStatusChange(
        memberId,
        data.fromStatus || 'Unknown',
        data.toStatus || 'Unknown',
        initiatedBy,
        data.reason || 'Membership status updated',
      );

      this.logger.debug(
        `Membership status change logged for member: ${memberId} from ${data.fromStatus} to ${data.toStatus}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log membership status change: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_ROLE_ASSIGNMENT)
  async handleRoleAssignment(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing role assignment log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      const scopeInfo = data.scopeName
        ? ` for ${data.scopeName}`
        : data.scopeType !== 'GLOBAL'
          ? ` at ${data.scopeType} level`
          : ' (Global)';

      await this.memberLifecycleService.logLifecycleEvent({
        memberId,
        activityType: ActivityType.ROLE_ASSIGNMENT,
        title: `Role Assigned: ${data.roleName}`,
        description: `Assigned role "${data.roleName}"${scopeInfo}${data.isPrimary ? ' (Primary)' : ''}`,
        initiatedBy,
        reason: data.reason || 'Role assignment',
        newPosition: data.roleName,
        tags: ['role-assignment', data.scopeType?.toLowerCase() || 'global'],
        notes: data.notes,
      });

      this.logger.debug(
        `Role assignment logged for member: ${memberId} with role: ${data.roleName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log role assignment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_ROLE_REMOVAL)
  async handleRoleRemoval(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing role removal log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logLifecycleEvent({
        memberId,
        activityType: ActivityType.ROLE_REMOVAL,
        title: `Role Removed: ${data.roleName}`,
        description: `Removed role "${data.roleName}"`,
        initiatedBy,
        reason: data.reason || 'Role removal',
        previousPosition: data.roleName,
        tags: ['role-removal'],
      });

      this.logger.debug(
        `Role removal logged for member: ${memberId} - role: ${data.roleName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log role removal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_MEMBER_REGISTRATION)
  async handleMemberRegistration(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing member registration log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logMemberRegistration(
        memberId,
        initiatedBy,
        data.source,
        data.dateJoined ? new Date(data.dateJoined) : undefined,
      );

      this.logger.debug(`Member registration logged for member: ${memberId}`);
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log member registration: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_UNIT_ASSIGNMENT)
  async handleUnitAssignment(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing unit assignment log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logUnitAssignment(
        memberId,
        data.unitId!,
        data.unitName!,
        initiatedBy,
        data.previousUnitId,
        data.previousUnitName,
        data.isFirstAssignment,
      );

      this.logger.debug(
        `Unit assignment logged for member: ${memberId} to ${data.unitName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log unit assignment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_DISTRICT_ASSIGNMENT)
  async handleDistrictAssignment(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing district assignment log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logDistrictAssignment(
        memberId,
        data.districtId!,
        data.districtName!,
        initiatedBy,
        data.previousDistrictId,
        data.previousDistrictName,
      );

      this.logger.debug(
        `District assignment logged for member: ${memberId} to ${data.districtName}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log district assignment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process(JobType.LOG_FIRST_TIMER_CONVERSION)
  async handleFirstTimerConversion(job: Job<ActivityLogJobData>) {
    this.logger.debug(
      `Processing first timer conversion log for member: ${job.data.memberId}`,
    );

    try {
      const { memberId, initiatedBy, data } = job.data;

      await this.memberLifecycleService.logFirstTimerConversion(
        memberId,
        data.firstTimerId!,
        initiatedBy,
        data.firstTimerDate ? new Date(data.firstTimerDate) : undefined,
      );

      this.logger.debug(
        `First timer conversion logged for member: ${memberId}`,
      );
      return { success: true, memberId };
    } catch (error) {
      this.logger.error(
        `Failed to log first timer conversion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FirstTimer, FirstTimerDocument } from '../first-timers/schemas/first-timer.schema';
import { MemberActivity, MemberActivityDocument } from '../activity-tracker/schemas/member-activity.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { NotificationDismissal, NotificationDismissalDocument } from './schemas/notification-dismissal.schema';
import { MembersService } from '../members/members.service';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { NotificationsPermission } from './permissions';
import { ActivityType, ActivityStatus } from '../common/enums/activity-tracker.enum';

export interface NotificationItem {
  id: string;
  type: 'assigned_first_timer' | 'birthday_upcoming' | 'ready_for_integration' | 'membership_status_change' | 'group_addition' | 'member_joined_your_group';
  title: string;
  description: string;
  createdAt: Date;
  data?: Record<string, any>;
}

export interface UserNotificationsResponse {
  totalCount: number;
  items: NotificationItem[];
  counts: {
    assignedFirstTimers: number;
    upcomingBirthdays: number;
    readyForIntegration: number;
    membershipStatusChanges: number;
    groupAdditions: number;
    membersJoinedYourGroups: number;
  };
}

@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  constructor(
    @InjectModel(FirstTimer.name) private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(MemberActivity.name) private memberActivityModel: Model<MemberActivityDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(NotificationDismissal.name) private notificationDismissalModel: Model<NotificationDismissalDocument>,
    private readonly membersService: MembersService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  /**
   * Get all pending notifications for a specific user
   */
  async getUserNotifications(
    userId: string,
    roleId: string,
    branchId?: string,
  ): Promise<UserNotificationsResponse> {
    // Get dismissed notification IDs for this user
    const dismissedNotifications = await this.notificationDismissalModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('notificationId')
      .lean()
      .exec();
    const dismissedIds = new Set(dismissedNotifications.map((d) => d.notificationId));

    const items: NotificationItem[] = [];
    const counts = {
      assignedFirstTimers: 0,
      upcomingBirthdays: 0,
      readyForIntegration: 0,
      membershipStatusChanges: 0,
      groupAdditions: 0,
      membersJoinedYourGroups: 0,
    };

    // Get assigned first-timers
    const assignedFirstTimers = await this.getAssignedFirstTimers(userId);

    for (const ft of assignedFirstTimers) {
      const ftId = (ft as any)._id?.toString() || '';
      const notificationId = `ft-${ftId}`;
      if (!dismissedIds.has(notificationId)) {
        counts.assignedFirstTimers++;
        items.push({
          id: notificationId,
          type: 'assigned_first_timer',
          title: 'First Timer Assigned',
          description: `${ft.firstName} ${ft.lastName} is assigned to you for follow-up`,
          createdAt: ft.createdAt,
          data: {
            firstTimerId: ftId,
            firstName: ft.firstName,
            lastName: ft.lastName,
            phone: ft.phone,
            email: ft.email,
          },
        });
      }
    }

    // Check if user has permission to receive birthday notifications
    try {
      const hasPreBirthdayPermission = await this.userPermissionsService.hasPermission(
        roleId,
        NotificationsPermission.RECEIVE_PRE_BIRTHDAY_NOTIFICATION,
      );

      if (hasPreBirthdayPermission) {
        const upcomingBirthdays = await this.membersService.getBirthdaysInDays(3, branchId);

        for (const member of upcomingBirthdays) {
          const notificationId = `bday-${member._id.toString()}`;
          if (!dismissedIds.has(notificationId)) {
            counts.upcomingBirthdays++;
            items.push({
              id: notificationId,
              type: 'birthday_upcoming',
              title: 'Upcoming Birthday',
              description: `${member.firstName} ${member.lastName} has a birthday in 3 days`,
              createdAt: new Date(),
              data: {
                memberId: member._id.toString(),
                firstName: member.firstName,
                lastName: member.lastName,
                dateOfBirth: member.dateOfBirth,
              },
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check birthday permission: ${error.message}`);
    }

    // Get first-timers ready for integration (for users with permission to view)
    const readyForIntegration = await this.getReadyForIntegration(branchId);

    for (const ft of readyForIntegration) {
      const ftId = (ft as any)._id?.toString() || '';
      const notificationId = `rfi-${ftId}`;
      if (!dismissedIds.has(notificationId)) {
        counts.readyForIntegration++;
        items.push({
          id: notificationId,
          type: 'ready_for_integration',
          title: 'Ready for Integration',
          description: `${ft.firstName} ${ft.lastName} is ready for integration`,
          createdAt: ft.readyForIntegrationDate || ft.updatedAt,
          data: {
            firstTimerId: ftId,
            firstName: ft.firstName,
            lastName: ft.lastName,
            phone: ft.phone,
            email: ft.email,
          },
        });
      }
    }

    // Get membership status changes for the user (last 30 days)
    const membershipStatusChanges = await this.getMembershipStatusChanges(userId);

    for (const activity of membershipStatusChanges) {
      const activityId = (activity as any)._id?.toString() || '';
      const notificationId = `msc-${activityId}`;
      if (!dismissedIds.has(notificationId)) {
        counts.membershipStatusChanges++;
        items.push({
          id: notificationId,
          type: 'membership_status_change',
          title: 'Membership Status Updated',
          description: activity.description || activity.title || 'Your membership status has been updated',
          createdAt: activity.activityDate || activity.createdAt,
          data: {
            activityId,
            previousValues: activity.previousValues,
            newValues: activity.newValues,
            reason: activity.reason,
          },
        });
      }
    }

    // Get group additions for the user (last 30 days)
    const groupAdditions = await this.getGroupAdditions(userId);

    for (const activity of groupAdditions) {
      const activityId = (activity as any)._id?.toString() || '';
      const notificationId = `ga-${activityId}`;
      if (!dismissedIds.has(notificationId)) {
        counts.groupAdditions++;
        const groupType = this.getGroupTypeFromActivity(activity.activityType);
        items.push({
          id: notificationId,
          type: 'group_addition',
          title: `Added to ${groupType}`,
          description: activity.description || activity.title || `You have been added to a ${groupType.toLowerCase()}`,
          createdAt: activity.activityDate || activity.createdAt,
          data: {
            activityId,
            groupType,
            toUnit: activity.toUnit?.toString(),
            toDistrict: activity.toDistrict?.toString(),
            toMinistries: activity.toMinistries?.map((m: Types.ObjectId) => m.toString()),
            reason: activity.reason,
          },
        });
      }
    }

    // Get members who joined groups where the user is a leader (last 30 days)
    const membersJoinedYourGroups = await this.getMembersJoinedYourGroups(userId);

    for (const activity of membersJoinedYourGroups) {
      const activityId = (activity as any)._id?.toString() || '';
      const notificationId = `mjg-${activityId}`;
      if (!dismissedIds.has(notificationId)) {
        counts.membersJoinedYourGroups++;
        const groupName = (activity as any).groupName || 'your group';
        const memberName = (activity as any).memberName || 'A member';
        items.push({
          id: notificationId,
          type: 'member_joined_your_group',
          title: 'New Member Joined',
          description: `${memberName} has joined ${groupName}`,
          createdAt: activity.activityDate || activity.createdAt,
          data: {
            activityId,
            memberId: activity.member?.toString(),
            groupId: activity.toUnit?.toString() || activity.toDistrict?.toString(),
            groupName,
            memberName,
          },
        });
      }
    }

    // Sort items by createdAt descending
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      totalCount: items.length,
      items,
      counts,
    };
  }

  /**
   * Get just the count of pending notifications for badge display
   * Uses getUserNotifications to ensure dismissed notifications are excluded
   */
  async getNotificationCount(
    userId: string,
    roleId: string,
    branchId?: string,
  ): Promise<number> {
    const notifications = await this.getUserNotifications(userId, roleId, branchId);
    return notifications.totalCount;
  }

  /**
   * Get first-timers assigned to a specific user
   */
  private async getAssignedFirstTimers(userId: string): Promise<FirstTimerDocument[]> {
    // Query with both string and ObjectId to handle both storage formats
    const userObjectId = new Types.ObjectId(userId);
    return this.firstTimerModel
      .find({
        $or: [
          { assignedTo: userId },
          { assignedTo: userObjectId },
          { followUpPerson: userId },
          { followUpPerson: userObjectId },
        ],
        isActive: true,
        isArchived: false,
        converted: false,
        stage: { $ne: 'closed' },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  /**
   * Get first-timers ready for integration
   */
  private async getReadyForIntegration(branchId?: string): Promise<FirstTimerDocument[]> {
    const query: any = {
      readyForIntegration: true,
      isActive: true,
      isArchived: false,
      converted: false,
    };

    if (branchId) {
      query.branch = new Types.ObjectId(branchId);
    }

    return this.firstTimerModel
      .find(query)
      .sort({ readyForIntegrationDate: -1 })
      .limit(50)
      .exec();
  }

  /**
   * Get membership status changes for a user (last 30 days)
   */
  private async getMembershipStatusChanges(userId: string): Promise<MemberActivityDocument[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.memberActivityModel
      .find({
        member: new Types.ObjectId(userId),
        activityType: ActivityType.MEMBERSHIP_STATUS_CHANGE,
        status: { $in: [ActivityStatus.ACTIVE, ActivityStatus.COMPLETED] },
        activityDate: { $gte: thirtyDaysAgo },
        isVisible: true,
      })
      .sort({ activityDate: -1 })
      .limit(10)
      .exec();
  }

  /**
   * Get group additions for a user (last 30 days)
   */
  private async getGroupAdditions(userId: string): Promise<MemberActivityDocument[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.memberActivityModel
      .find({
        member: new Types.ObjectId(userId),
        activityType: {
          $in: [
            ActivityType.UNIT_ASSIGNMENT,
            ActivityType.DISTRICT_ASSIGNMENT,
            ActivityType.MINISTRY_ASSIGNMENT,
          ],
        },
        status: { $in: [ActivityStatus.ACTIVE, ActivityStatus.COMPLETED] },
        activityDate: { $gte: thirtyDaysAgo },
        isVisible: true,
      })
      .sort({ activityDate: -1 })
      .limit(20)
      .exec();
  }

  /**
   * Helper to get friendly group type name from activity type
   */
  private getGroupTypeFromActivity(activityType: ActivityType): string {
    switch (activityType) {
      case ActivityType.UNIT_ASSIGNMENT:
        return 'Unit';
      case ActivityType.DISTRICT_ASSIGNMENT:
        return 'District';
      case ActivityType.MINISTRY_ASSIGNMENT:
        return 'Ministry';
      default:
        return 'Group';
    }
  }

  /**
   * Get groups where the user is a leader
   */
  private async getGroupsWhereUserIsLeader(userId: string): Promise<GroupDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    return this.groupModel
      .find({
        isActive: true,
        $or: [
          { districtPastor: userObjectId },
          { unitHead: userObjectId },
          { assistantUnitHead: userObjectId },
          { ministryDirector: userObjectId },
        ],
      })
      .exec();
  }

  /**
   * Get members who joined groups where the user is a leader (last 30 days)
   */
  private async getMembersJoinedYourGroups(userId: string): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First, find all groups where user is a leader
    const leaderGroups = await this.getGroupsWhereUserIsLeader(userId);

    if (leaderGroups.length === 0) {
      return [];
    }

    const groupIds = leaderGroups.map((g) => (g as any)._id);
    const groupNameMap = new Map<string, string>();
    leaderGroups.forEach((g) => {
      groupNameMap.set((g as any)._id.toString(), g.name);
    });

    // Find member activities where members joined these groups
    const activities = await this.memberActivityModel
      .find({
        activityType: {
          $in: [
            ActivityType.UNIT_ASSIGNMENT,
            ActivityType.DISTRICT_ASSIGNMENT,
            ActivityType.MINISTRY_ASSIGNMENT,
          ],
        },
        status: { $in: [ActivityStatus.ACTIVE, ActivityStatus.COMPLETED] },
        activityDate: { $gte: thirtyDaysAgo },
        isVisible: true,
        $or: [
          { toUnit: { $in: groupIds } },
          { toDistrict: { $in: groupIds } },
          { toMinistries: { $in: groupIds } },
        ],
        // Exclude the leader themselves
        member: { $ne: new Types.ObjectId(userId) },
      })
      .populate('member', 'firstName lastName')
      .sort({ activityDate: -1 })
      .limit(50)
      .exec();

    // Enrich with group names and member names
    return activities.map((activity) => {
      const groupId = activity.toUnit?.toString() || activity.toDistrict?.toString() ||
        (activity.toMinistries && activity.toMinistries.length > 0 ? activity.toMinistries[0].toString() : '');
      const groupName = groupNameMap.get(groupId) || 'your group';
      const member = activity.member as any;
      const memberName = member?.firstName && member?.lastName
        ? `${member.firstName} ${member.lastName}`
        : 'A member';

      return {
        ...activity.toObject(),
        groupName,
        memberName,
      };
    });
  }

  /**
   * Dismiss a single notification for a user
   */
  async dismissNotification(userId: string, notificationId: string): Promise<void> {
    await this.notificationDismissalModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        notificationId,
      },
      {
        userId: new Types.ObjectId(userId),
        notificationId,
        dismissedAt: new Date(),
      },
      { upsert: true },
    );
  }

  /**
   * Dismiss multiple notifications for a user
   */
  async dismissNotifications(userId: string, notificationIds: string[]): Promise<void> {
    const operations = notificationIds.map((notificationId) => ({
      updateOne: {
        filter: {
          userId: new Types.ObjectId(userId),
          notificationId,
        },
        update: {
          userId: new Types.ObjectId(userId),
          notificationId,
          dismissedAt: new Date(),
        },
        upsert: true,
      },
    }));

    await this.notificationDismissalModel.bulkWrite(operations);
  }

  /**
   * Dismiss all notifications for a user
   */
  async dismissAllNotifications(userId: string, roleId: string, branchId?: string): Promise<number> {
    // Get all current notifications
    const notifications = await this.getUserNotifications(userId, roleId, branchId);
    const notificationIds = notifications.items.map((item) => item.id);

    if (notificationIds.length > 0) {
      await this.dismissNotifications(userId, notificationIds);
    }

    return notificationIds.length;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';

@Injectable()
export class FirstTimerMessagingService {
  private readonly logger = new Logger(FirstTimerMessagingService.name);

  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    private notificationsService: NotificationsService,
    private queueService: QueueService,
  ) {}

  async setPreFilledMessage(
    firstTimerId: string,
    message: string,
    scheduledTime?: Date,
  ): Promise<void> {
    const now = new Date();
    let messageScheduledTime = scheduledTime;

    if (!messageScheduledTime) {
      // Default to 7PM today or 2 hours after current time if past 7PM
      const todayAt7PM = new Date();
      todayAt7PM.setHours(19, 0, 0, 0);

      if (now > todayAt7PM) {
        // If past 7PM, schedule for 2 hours from now
        messageScheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      } else {
        messageScheduledTime = todayAt7PM;
      }
    }

    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, {
      preFilledMessage: message,
      messageScheduledTime,
      messageSent: false,
    });

    // Schedule the message job
    await this.queueService.addJob(JobType.SEND_FIRST_TIMER_MESSAGE, {
      firstTimerId,
      message,
      scheduledTime: messageScheduledTime,
    });

    this.logger.log(
      `Pre-filled message set for first timer ${firstTimerId}, scheduled for ${messageScheduledTime}`,
    );
  }

  async setBulkPreFilledMessage(
    firstTimerIds: string[],
    message: string,
    scheduledTime?: Date,
  ): Promise<void> {
    const promises = firstTimerIds.map((id) =>
      this.setPreFilledMessage(id, message, scheduledTime),
    );
    await Promise.all(promises);
  }

  async sendScheduledMessage(firstTimerId: string): Promise<void> {
    const firstTimer = await this.firstTimerModel.findById(firstTimerId);
    if (!firstTimer || firstTimer.messageSent || !firstTimer.preFilledMessage) {
      return;
    }

    if (!firstTimer.email) {
      this.logger.warn(
        `Cannot send message to first timer ${firstTimerId} - no email address`,
      );
      return;
    }

    try {
      await this.notificationsService.sendCustomFirstTimerMessage({
        email: firstTimer.email,
        firstName: firstTimer.firstName,
        lastName: firstTimer.lastName,
        customMessage: firstTimer.preFilledMessage,
      });

      await this.firstTimerModel.findByIdAndUpdate(firstTimerId, {
        messageSent: true,
        messageSentAt: new Date(),
      });

      this.logger.log(`Message sent to first timer ${firstTimerId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to first timer ${firstTimerId}:`,
        error,
      );
    }
  }

  // Cron job to check for first-timers without pre-filled messages
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkForMissingMessages(): Promise<void> {
    this.logger.log('Checking for first-timers without pre-filled messages...');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find first-timers created more than 2 hours ago without pre-filled messages
    const firstTimersWithoutMessages = await this.firstTimerModel
      .find({
        createdAt: { $lt: twoHoursAgo },
        $or: [
          { preFilledMessage: { $exists: false } },
          { preFilledMessage: null },
          { preFilledMessage: '' },
        ],
        stage: 'new', // Only check new first-timers
        isActive: true,
      })
      .populate('giaLeader', 'firstName lastName email')
      .exec();

    if (firstTimersWithoutMessages.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${firstTimersWithoutMessages.length} first-timers without pre-filled messages`,
    );

    // Group by unit leader
    const groupedByLeader = firstTimersWithoutMessages.reduce(
      (acc: any, ft) => {
        const leaderId = ft.giaLeader?._id?.toString() || 'no-leader';
        if (!acc[leaderId]) {
          acc[leaderId] = {
            leader: ft.giaLeader,
            firstTimers: [],
          };
        }
        acc[leaderId].firstTimers.push(ft);
        return acc;
      },
      {},
    );

    // Send notifications to unit leaders
    for (const [leaderId, data] of Object.entries(groupedByLeader)) {
      const leaderData = data as any;
      if (leaderId === 'no-leader' || !leaderData.leader?.email) {
        this.logger.warn(
          `No leader or leader email found for first-timers: ${leaderData.firstTimers
            .map((ft: any) => `${ft.firstName} ${ft.lastName}`)
            .join(', ')}`,
        );
        continue;
      }

      try {
        await this.notificationsService.sendUnitLeaderNotification({
          leaderEmail: leaderData.leader.email,
          leaderName: `${leaderData.leader.firstName} ${leaderData.leader.lastName}`,
          noMessageFirstTimers: leaderData.firstTimers.map((ft: any) => ({
            firstName: ft.firstName,
            lastName: ft.lastName,
            dateOfVisit: ft.dateOfVisit.toISOString().split('T')[0],
          })),
        });

        this.logger.log(
          `Notification sent to leader ${leaderData.leader.email} for ${leaderData.firstTimers.length} first-timers`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send notification to leader ${leaderData.leader.email}:`,
          error,
        );
      }
    }
  }

  // Cron job to send scheduled messages
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendScheduledMessages(): Promise<void> {
    const now = new Date();

    const firstTimersToMessage = await this.firstTimerModel
      .find({
        messageScheduledTime: { $lte: now },
        messageSent: false,
        preFilledMessage: { $exists: true, $nin: [null, ''] },
        email: { $exists: true, $nin: [null, ''] },
        isActive: true,
      })
      .exec();

    if (firstTimersToMessage.length === 0) {
      return;
    }

    this.logger.log(
      `Sending scheduled messages to ${firstTimersToMessage.length} first-timers`,
    );

    const promises = firstTimersToMessage.map((ft: any) =>
      this.sendScheduledMessage(ft._id.toString()),
    );

    await Promise.allSettled(promises);
  }

  async assignFirstTimerForFollowUp(
    firstTimerId: string,
    assigneeId: string,
    assignedBy: string,
  ): Promise<void> {
    // Update first timer with assignment
    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, {
      assignedTo: assigneeId,
      followUpPerson: assigneeId,
      stage: 'engaged',
      lastStatusChange: new Date(),
    });

    // Get first timer details
    const firstTimer = await this.firstTimerModel.findById(firstTimerId).exec();

    if (!firstTimer) {
      this.logger.error(`First timer ${firstTimerId} not found`);
      return;
    }

    // Get assignee details from members collection
    try {
      // This would need to be imported from members service
      // For now, we'll add a queue job to handle the notification
      await this.queueService.addJob(JobType.SEND_ASSIGNMENT_NOTIFICATION, {
        firstTimerId,
        assigneeId,
        assignedBy,
        firstTimerData: {
          firstName: firstTimer.firstName,
          lastName: firstTimer.lastName,
          phone: firstTimer.phone,
          email: firstTimer.email,
          dateOfVisit: firstTimer.dateOfVisit.toISOString().split('T')[0],
        },
      });

      this.logger.log(
        `First timer ${firstTimerId} assigned to ${assigneeId} by ${assignedBy}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue assignment notification for ${firstTimerId}:`,
        error,
      );
    }
  }

  async bulkAssignFirstTimers(
    assignments: Array<{
      firstTimerId: string;
      assigneeId: string;
    }>,
    assignedBy: string,
  ): Promise<void> {
    // Process assignments individually
    const promises = assignments.map((assignment) =>
      this.assignFirstTimerForFollowUp(
        assignment.firstTimerId,
        assignment.assigneeId,
        assignedBy,
      ),
    );

    await Promise.all(promises);

    // Group assignments by assignee for bulk notification
    const assignmentsByAssignee = assignments.reduce(
      (acc, assignment) => {
        if (!acc[assignment.assigneeId]) {
          acc[assignment.assigneeId] = [];
        }
        acc[assignment.assigneeId].push(assignment.firstTimerId);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    // Queue bulk notification jobs for each assignee
    for (const [assigneeId, firstTimerIds] of Object.entries(
      assignmentsByAssignee,
    )) {
      try {
        await this.queueService.addJob(
          JobType.SEND_BULK_ASSIGNMENT_NOTIFICATION,
          {
            assigneeId,
            firstTimerIds,
            assignedBy,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue bulk assignment notification for assignee ${assigneeId}:`,
          error,
        );
      }
    }
  }

  async updateIntegrationStage(
    firstTimerId: string,
    integrationStage: string,
    assignedDistrict?: string,
  ): Promise<void> {
    const updateData: any = {
      integrationStage,
      integrationStageDate: new Date(),
      lastStatusChange: new Date(),
    };

    if (assignedDistrict) {
      updateData.assignedDistrict = assignedDistrict;
      updateData.districtAssignmentDate = new Date();
    }

    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, updateData);

    // If being assigned to district, notify district pastor
    if (integrationStage === 'assigned_to_district' && assignedDistrict) {
      try {
        const firstTimer = await this.firstTimerModel
          .findById(firstTimerId)
          .exec();
        if (firstTimer) {
          await this.queueService.addJob(
            JobType.SEND_DISTRICT_ASSIGNMENT_NOTIFICATION,
            {
              firstTimerId,
              assignedDistrict,
              newMemberData: {
                firstName: firstTimer.firstName,
                lastName: firstTimer.lastName,
                phone: firstTimer.phone,
                email: firstTimer.email,
                integratedDate: new Date().toISOString().split('T')[0],
              },
            },
          );
        }

        this.logger.log(
          `First timer ${firstTimerId} assigned to district ${assignedDistrict} - notification queued`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue district assignment notification for ${firstTimerId}:`,
          error,
        );
      }
    }
  }

  async closeFirstTimer(
    firstTimerId: string,
    reason: 'unwilling' | 'became_member',
    memberRecordId?: string,
  ): Promise<void> {
    const updateData: any = {
      stage: 'closed',
      lastStatusChange: new Date(),
    };

    if (reason === 'became_member' && memberRecordId) {
      updateData.converted = true;
      updateData.conversionDate = new Date();
      updateData.memberRecord = memberRecordId;
      updateData.memberCreatedAt = new Date();
    }

    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, updateData);

    this.logger.log(
      `First timer ${firstTimerId} closed with reason: ${reason}`,
    );
  }

  async convertInterestedFirstTimersToMembers(): Promise<void> {
    this.logger.log(
      'Checking for interested first-timers to convert to members...',
    );

    // Find first-timers who are interested in joining but haven't been converted yet
    const interestedFirstTimers = await this.firstTimerModel
      .find({
        interestedInJoining: true,
        converted: false,
        stage: { $ne: 'closed' },
        isActive: true,
        // Additional criteria: has completed at least 2 call reports or attended 2nd service
        $or: [
          { callReportsCount: { $gte: 2 } },
          {
            // Check if they have call reports with service attendance
            $expr: {
              $gt: [{ $size: { $ifNull: ['$followUps', []] } }, 1],
            },
          },
        ],
      })
      .exec();

    if (interestedFirstTimers.length === 0) {
      this.logger.log('No interested first-timers found for conversion');
      return;
    }

    this.logger.log(
      `Found ${interestedFirstTimers.length} first-timers ready for member conversion`,
    );

    // Queue job for creating member records
    for (const firstTimer of interestedFirstTimers) {
      try {
        await this.queueService.addJob(JobType.CREATE_MEMBER_FROM_FIRST_TIMER, {
          firstTimerId: (firstTimer._id as any).toString(),
          firstTimerData: {
            firstName: firstTimer.firstName,
            lastName: firstTimer.lastName,
            phone: firstTimer.phone,
            email: firstTimer.email,
            dateOfBirth: firstTimer.dateOfBirth,
            address: firstTimer.address,
            occupation: firstTimer.occupation,
            maritalStatus: firstTimer.maritalStatus,
            numberOfChildren: firstTimer.numberOfChildren,
            assignedDistrict: firstTimer.assignedDistrict,
          },
        });

        this.logger.log(
          `Queued member creation for first timer ${firstTimer._id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue member creation for first timer ${firstTimer._id}:`,
          error,
        );
      }
    }
  }

  // Cron job to periodically check for first-timers ready for member conversion
  @Cron(CronExpression.EVERY_HOUR)
  async checkForMemberConversion(): Promise<void> {
    await this.convertInterestedFirstTimersToMembers();
  }
}

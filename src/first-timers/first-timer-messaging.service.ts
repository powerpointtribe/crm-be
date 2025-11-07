import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import { MessageHistory, MessageHistoryDocument } from './schemas/message-history.schema';
import { DailyMessage, DailyMessageDocument } from './schemas/daily-message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queue/queue.service';
import { JobType } from '../common/interfaces/queue-job.interface';

@Injectable()
export class FirstTimerMessagingService {
  private readonly logger = new Logger(FirstTimerMessagingService.name);

  constructor(
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    @InjectModel(MessageHistory.name)
    private messageHistoryModel: Model<MessageHistoryDocument>,
    @InjectModel(DailyMessage.name)
    private dailyMessageModel: Model<DailyMessageDocument>,
    private notificationsService: NotificationsService,
    private queueService: QueueService,
  ) {}

  async setPreFilledMessage(
    firstTimerId: string,
    message: string,
    scheduledTime?: Date,
    createdBy?: string,
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

    // Create message history record
    await this.messageHistoryModel.create({
      firstTimerId,
      message,
      scheduledTime: messageScheduledTime,
      createdBy: createdBy || null,
      status: 'scheduled',
    });

    // Schedule the message job
    // await this.queueService.addJob(JobType.SEND_FIRST_TIMER_MESSAGE, {
    //   firstTimerId,
    //   message,
    //   scheduledTime: messageScheduledTime,
    // });

    this.logger.log(
      `Pre-filled message set for first timer ${firstTimerId}, scheduled for ${messageScheduledTime}`,
    );
  }

  async setBulkPreFilledMessage(
    firstTimerIds: string[],
    message: string,
    scheduledTime?: Date,
    createdBy?: string,
  ): Promise<void> {
    const promises = firstTimerIds.map((id) =>
      this.setPreFilledMessage(id, message, scheduledTime, createdBy),
    );
    await Promise.all(promises);
  }

  // Update message history to mark as sent (called from queue processor)
  async updateMessageHistoryAsSent(firstTimerId: string, sentAt: Date, messageContent: string): Promise<void> {
    try {
      await this.messageHistoryModel.findOneAndUpdate(
        {
          firstTimerId,
          message: messageContent,
          status: 'scheduled',
          isCancelled: false
        },
        {
          status: 'sent',
          sentAt,
          isSent: true
        }
      );

      this.logger.log(`Message history updated as sent for first-timer ${firstTimerId}`);
    } catch (error) {
      this.logger.error(`Failed to update message history for ${firstTimerId}:`, error);
    }
  }

  // Update message history to mark as failed (called from queue processor)
  async updateMessageHistoryAsFailed(firstTimerId: string, messageContent: string, failureReason: string): Promise<void> {
    try {
      await this.messageHistoryModel.findOneAndUpdate(
        {
          firstTimerId,
          message: messageContent,
          status: 'scheduled',
          isCancelled: false
        },
        {
          status: 'failed',
          failureReason
        }
      );

      this.logger.log(`Message history updated as failed for first-timer ${firstTimerId}`);
    } catch (error) {
      this.logger.error(`Failed to update message history as failed for ${firstTimerId}:`, error);
    }
  }

  // Cron job to create daily message entries for dates that have first timers but no entry
  @Cron(CronExpression.EVERY_2_HOURS)
  async createMissingDailyMessageEntries(): Promise<void> {
    this.logger.log('Checking for missing daily message entries...');

    try {
      // Get all unique visit dates from first timers in the last 60 days
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const visitDates = await this.firstTimerModel.distinct('dateOfVisit', {
        dateOfVisit: { $gte: sixtyDaysAgo },
        isActive: true
      });

      let entriesCreated = 0;

      for (const visitDate of visitDates) {
        try {
          const result = await this.ensureDailyMessageEntry(new Date(visitDate));
          if (result) {
            entriesCreated++;
          }
        } catch (error) {
          this.logger.error(`Failed to ensure daily message entry for ${visitDate}:`, error);
        }
      }

      this.logger.log(`Created ${entriesCreated} missing daily message entries`);
    } catch (error) {
      this.logger.error('Failed to create missing daily message entries:', error);
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
      `Queuing scheduled messages for ${firstTimersToMessage.length} first-timers`,
    );

    // Queue each message for processing instead of sending directly
    // const promises = firstTimersToMessage.map((ft: any) =>
    //   this.queueService.addJob(JobType.SEND_FIRST_TIMER_MESSAGE, {
    //     firstTimerId: ft._id.toString(),
    //     message: ft.preFilledMessage,
    //     scheduledTime: ft.messageScheduledTime,
    //   }),
    // );

    // await Promise.allSettled(promises);
  }

  // Legacy assignment methods removed - use FirstTimersService.assignToMember() instead

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
          // District assignment notification would be handled separately
          // Legacy SEND_DISTRICT_ASSIGNMENT_NOTIFICATION job type removed
        }

        this.logger.log(
          `First timer ${firstTimerId} assigned to district ${assignedDistrict}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process district assignment for ${firstTimerId}:`,
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

  // New messaging history and management methods
  async getMessageHistory(firstTimerId: string): Promise<MessageHistoryDocument[]> {
    return await this.messageHistoryModel
      .find({ firstTimerId })
      .populate('createdBy', 'firstName lastName')
      .populate('editedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getScheduledMessage(firstTimerId: string): Promise<MessageHistoryDocument | null> {
    return await this.messageHistoryModel
      .findOne({
        firstTimerId,
        status: 'scheduled',
        isCancelled: false
      })
      .populate('createdBy', 'firstName lastName')
      .exec();
  }

  async editScheduledMessage(
    firstTimerId: string,
    newMessage: string,
    newScheduledTime?: Date,
    editedBy?: string
  ): Promise<void> {
    const existingMessage = await this.getScheduledMessage(firstTimerId);

    if (!existingMessage) {
      throw new NotFoundException('No scheduled message found for this first timer');
    }

    const now = new Date();
    let messageScheduledTime = newScheduledTime;

    if (!messageScheduledTime) {
      // Default to 7PM today or 2 hours after current time if past 7PM
      const todayAt7PM = new Date();
      todayAt7PM.setHours(19, 0, 0, 0);

      if (now > todayAt7PM) {
        messageScheduledTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      } else {
        messageScheduledTime = todayAt7PM;
      }
    }

    // Update first timer with new message
    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, {
      preFilledMessage: newMessage,
      messageScheduledTime,
      messageSent: false,
    });

    // Update message history
    await this.messageHistoryModel.findByIdAndUpdate(existingMessage._id, {
      message: newMessage,
      scheduledTime: messageScheduledTime,
      editedBy: editedBy || null,
      editedAt: now,
    });

    this.logger.log(
      `Scheduled message updated for first timer ${firstTimerId}, new schedule: ${messageScheduledTime}`,
    );
  }

  async cancelScheduledMessage(firstTimerId: string, cancelledBy?: string): Promise<void> {
    const existingMessage = await this.getScheduledMessage(firstTimerId);

    if (!existingMessage) {
      throw new NotFoundException('No scheduled message found for this first timer');
    }

    // Clear message from first timer
    await this.firstTimerModel.findByIdAndUpdate(firstTimerId, {
      preFilledMessage: null,
      messageScheduledTime: null,
      messageSent: false,
    });

    // Mark message as cancelled in history
    await this.messageHistoryModel.findByIdAndUpdate(existingMessage._id, {
      status: 'cancelled',
      isCancelled: true,
      editedBy: cancelledBy || null,
      editedAt: new Date(),
    });

    this.logger.log(`Scheduled message cancelled for first timer ${firstTimerId}`);
  }

  async getAllMessageHistory(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ messages: MessageHistoryDocument[], total: number }> {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const [messages, total] = await Promise.all([
      this.messageHistoryModel
        .find(filter)
        .populate('firstTimerId', 'firstName lastName phone email')
        .populate('createdBy', 'firstName lastName')
        .populate('editedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageHistoryModel.countDocuments(filter)
    ]);

    return { messages, total };
  }

  // Daily messaging methods
  async createDailyMessage(
    date: Date,
    message: string,
    firstTimerIds: string[],
    createdBy: string,
    scheduledTime?: Date,
    autoSend: boolean = true
  ): Promise<DailyMessageDocument> {
    // Check if daily message already exists for this date
    const existingDaily = await this.dailyMessageModel.findOne({
      date: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });

    if (existingDaily) {
      // If it's an auto-generated draft, update it with the provided message
      if (existingDaily.status === 'draft' && (!existingDaily.message || existingDaily.message === '')) {
        existingDaily.message = message;
        existingDaily.scheduledTime = scheduledTime;
        existingDaily.autoSend = autoSend;
        existingDaily.createdBy = new Types.ObjectId(createdBy);
        existingDaily.status = autoSend ? 'sending' : 'scheduled';

        // Update first timer IDs if provided
        if (firstTimerIds && firstTimerIds.length > 0) {
          existingDaily.firstTimerIds = firstTimerIds.map(id => new Types.ObjectId(id));
          existingDaily.recipientCount = firstTimerIds.length;
        }

        await existingDaily.save();
        this.logger.log(`Updated existing draft daily message for ${date.toDateString()}`);
        return existingDaily;
      } else {
        throw new BadRequestException('Daily message already exists for this date');
      }
    }

    const dailyMessage = await this.dailyMessageModel.create({
      date,
      message,
      scheduledTime,
      autoSend,
      firstTimerIds: firstTimerIds.map(id => new Types.ObjectId(id)),
      createdBy: new Types.ObjectId(createdBy),
      recipientCount: firstTimerIds.length,
      status: autoSend ? 'sending' : 'scheduled',
    });

    this.logger.log(`Daily message created for ${date.toDateString()} with ${firstTimerIds.length} recipients`);

    return dailyMessage;
  }

  async getDailyMessage(date: Date): Promise<DailyMessageDocument | null> {
    return await this.dailyMessageModel
      .findOne({
        date: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        }
      })
      .populate('createdBy', 'firstName lastName')
      .exec();
  }

  async sendDailyMessageNow(dailyMessageId: string, sentBy?: string): Promise<void> {
    const dailyMessage = await this.dailyMessageModel.findById(dailyMessageId);

    if (!dailyMessage) {
      throw new NotFoundException('Daily message not found');
    }

    if (dailyMessage.isSent) {
      throw new BadRequestException('Daily message has already been sent');
    }

    // Update status to sending
    await this.dailyMessageModel.findByIdAndUpdate(dailyMessageId, {
      status: 'sending',
      sentBy: sentBy || null,
    });

    try {
      // Send to all first timers
      const promises = dailyMessage.firstTimerIds.map((firstTimerId) =>
        this.setPreFilledMessage(
          firstTimerId.toString(),
          dailyMessage.message,
          undefined, // Send immediately
          sentBy
        )
      );

      await Promise.all(promises);

      // Update daily message as sent
      await this.dailyMessageModel.findByIdAndUpdate(dailyMessageId, {
        status: 'sent',
        isSent: true,
        sentAt: new Date(),
        sentCount: dailyMessage.firstTimerIds.length,
      });

      this.logger.log(`Daily message ${dailyMessageId} sent to ${dailyMessage.firstTimerIds.length} first timers`);

    } catch (error) {
      // Update status to failed
      await this.dailyMessageModel.findByIdAndUpdate(dailyMessageId, {
        status: 'failed',
        failureReason: error.message,
      });

      this.logger.error(`Failed to send daily message ${dailyMessageId}:`, error);
      throw error;
    }
  }

  async getDailyMessages(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ messages: DailyMessageDocument[], total: number }> {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    const [messages, total] = await Promise.all([
      this.dailyMessageModel
        .find(filter)
        .populate('createdBy', 'firstName lastName')
        .populate('sentBy', 'firstName lastName')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.dailyMessageModel.countDocuments(filter)
    ]);

    return { messages, total };
  }

  // Cron job to send scheduled daily messages
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendScheduledDailyMessages(): Promise<void> {
    const now = new Date();

    const scheduledDailyMessages = await this.dailyMessageModel
      .find({
        status: 'scheduled',
        scheduledTime: { $lte: now },
        isSent: false,
      })
      .exec();

    if (scheduledDailyMessages.length === 0) {
      return;
    }

    this.logger.log(`Sending ${scheduledDailyMessages.length} scheduled daily messages`);

    const promises = scheduledDailyMessages.map((dailyMessage) =>
      this.sendDailyMessageNow((dailyMessage._id as any).toString())
    );

    await Promise.allSettled(promises);
  }

  async updateDailyMessage(
    dailyMessageId: string,
    message: string,
    scheduledTime?: Date,
    autoSend: boolean = true,
    editedBy?: string
  ): Promise<DailyMessageDocument> {
    const dailyMessage = await this.dailyMessageModel.findById(dailyMessageId);

    if (!dailyMessage) {
      throw new NotFoundException('Daily message not found');
    }

    if (dailyMessage.isSent) {
      throw new BadRequestException('Cannot update a message that has already been sent');
    }

    const updateData: any = {
      message,
      scheduledTime,
      autoSend,
      status: autoSend ? 'sending' : 'scheduled',
      editedBy: editedBy || null,
      editedAt: new Date(),
    };

    const updatedMessage = await this.dailyMessageModel.findByIdAndUpdate(
      dailyMessageId,
      updateData,
      { new: true }
    );

    // If auto-send is enabled, send immediately
    if (autoSend && !dailyMessage.isSent) {
      await this.sendDailyMessageNow(dailyMessageId, editedBy);
    }

    this.logger.log(`Daily message ${dailyMessageId} updated`);

    return updatedMessage!;
  }

  async deleteDailyMessage(dailyMessageId: string, deletedBy?: string): Promise<void> {
    const dailyMessage = await this.dailyMessageModel.findById(dailyMessageId);

    if (!dailyMessage) {
      throw new NotFoundException('Daily message not found');
    }

    if (dailyMessage.isSent) {
      throw new BadRequestException('Cannot delete a message that has already been sent');
    }

    await this.dailyMessageModel.findByIdAndDelete(dailyMessageId);

    this.logger.log(`Daily message ${dailyMessageId} deleted by ${deletedBy || 'unknown'}`);
  }

  // Auto-create or update daily message entry when first timers visit
  async ensureDailyMessageEntry(visitDate: Date, firstTimerIds?: string[]): Promise<DailyMessageDocument | null> {
    try {
      // Check if a daily message already exists for this date
      const existingDaily = await this.dailyMessageModel.findOne({
        date: {
          $gte: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate()),
          $lt: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate() + 1)
        }
      });

      if (existingDaily) {
        // Update existing entry with new first timer IDs if provided
        if (firstTimerIds && firstTimerIds.length > 0) {
          // Get current first timers for this date
          const currentFirstTimers = await this.firstTimerModel.find({
            dateOfVisit: {
              $gte: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate()),
              $lt: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate() + 1)
            },
            isActive: true
          });

          const allFirstTimerIds = currentFirstTimers.map(ft => ft._id as Types.ObjectId);

          // Update the existing daily message with current first timer IDs
          existingDaily.firstTimerIds = allFirstTimerIds;
          existingDaily.recipientCount = allFirstTimerIds.length;
          await existingDaily.save();

          this.logger.log(`Updated daily message entry for ${visitDate.toDateString()} with ${allFirstTimerIds.length} first timers`);
        }
        return existingDaily;
      }

      // Get all first timers for this date
      const dateFirstTimers = await this.firstTimerModel.find({
        dateOfVisit: {
          $gte: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate()),
          $lt: new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate() + 1)
        },
        isActive: true
      });

      if (dateFirstTimers.length === 0) {
        return null; // No first timers for this date
      }

      const firstTimerObjectIds = dateFirstTimers.map(ft => ft._id as Types.ObjectId);

      // Create a new daily message entry (draft status)
      const dailyMessage = await this.dailyMessageModel.create({
        date: visitDate,
        message: '', // Empty message - to be filled by admin
        status: 'draft',
        autoSend: false,
        isSent: false,
        recipientCount: firstTimerObjectIds.length,
        firstTimerIds: firstTimerObjectIds,
        createdBy: undefined, // System generated
      });

      this.logger.log(`Auto-created daily message entry for ${visitDate.toDateString()} with ${firstTimerObjectIds.length} first timers`);
      return dailyMessage;

    } catch (error) {
      this.logger.error(`Failed to ensure daily message entry for ${visitDate.toDateString()}:`, error);
      return null;
    }
  }

  // Get or create daily message entry for a specific date
  async getOrCreateDailyMessageEntry(dateString: string): Promise<DailyMessageDocument | null> {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid date format');
      }

      // First try to get existing message
      let dailyMessage = await this.getDailyMessage(date);

      if (!dailyMessage) {
        // Create one if it doesn't exist and there are first timers for this date
        dailyMessage = await this.ensureDailyMessageEntry(date);
      }

      return dailyMessage;
    } catch (error) {
      this.logger.error(`Failed to get or create daily message entry for ${dateString}:`, error);
      throw error;
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MessageDraft,
  MessageDraftDocument,
} from './schemas/message-draft.schema';
import { FirstTimer, FirstTimerDocument } from './schemas/first-timer.schema';
import {
  CreateMessageDraftDto,
  UpdateMessageDraftDto,
  MessageDraftQueryDto,
} from './dto/message-draft.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessageDraftsService {
  private readonly logger = new Logger(MessageDraftsService.name);

  constructor(
    @InjectModel(MessageDraft.name)
    private messageDraftModel: Model<MessageDraftDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new message draft
   */
  async create(
    createDto: CreateMessageDraftDto,
    userId: string,
  ): Promise<MessageDraftDocument> {
    // Parse the scheduled date and time
    const scheduledDateTime = this.parseDateTime(
      createDto.scheduledDate,
      createDto.scheduledTime,
    );

    // Check if a draft already exists for this date
    const existing = await this.messageDraftModel.findOne({
      scheduledDate: new Date(createDto.scheduledDate),
      status: { $in: ['draft', 'scheduled'] },
    });

    if (existing) {
      throw new BadRequestException(
        `A draft already exists for ${createDto.scheduledDate}. Please edit or delete it first.`,
      );
    }

    // Generate default title if not provided
    const title = createDto.title || this.generateDefaultTitle(createDto.scheduledDate);

    const draft = await this.messageDraftModel.create({
      title,
      message: createDto.message,
      scheduledDate: new Date(createDto.scheduledDate),
      scheduledTime: scheduledDateTime,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
    });

    this.logger.log(`Message draft created for ${createDto.scheduledDate}`);
    return draft;
  }

  /**
   * Get all message drafts with pagination
   */
  async findAll(query: MessageDraftQueryDto): Promise<{
    drafts: MessageDraftDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const [drafts, total] = await Promise.all([
      this.messageDraftModel
        .find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageDraftModel.countDocuments(filter),
    ]);

    return {
      drafts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single message draft by ID
   */
  async findOne(id: string): Promise<MessageDraftDocument> {
    const draft = await this.messageDraftModel
      .findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .exec();

    if (!draft) {
      throw new NotFoundException('Message draft not found');
    }

    return draft;
  }

  /**
   * Update a message draft
   */
  async update(
    id: string,
    updateDto: UpdateMessageDraftDto,
    userId: string,
  ): Promise<MessageDraftDocument> {
    const draft = await this.findOne(id);

    // Don't allow editing sent or sending drafts
    if (draft.status === 'sent' || draft.status === 'sending') {
      throw new BadRequestException(
        `Cannot edit a draft that is ${draft.status}`,
      );
    }

    const updateData: any = {
      updatedBy: userId,
    };

    if (updateDto.title !== undefined) {
      updateData.title = updateDto.title;
    }

    if (updateDto.message !== undefined) {
      updateData.message = updateDto.message;
    }

    if (updateDto.scheduledDate !== undefined) {
      updateData.scheduledDate = new Date(updateDto.scheduledDate);
    }

    if (updateDto.scheduledTime !== undefined) {
      const scheduledDate =
        updateDto.scheduledDate || draft.scheduledDate.toISOString().split('T')[0];
      updateData.scheduledTime = this.parseDateTime(
        scheduledDate,
        updateDto.scheduledTime,
      );
    }

    const updated = await this.messageDraftModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Message draft not found');
    }

    this.logger.log(`Message draft ${id} updated`);
    return updated;
  }

  /**
   * Delete a message draft
   */
  async delete(id: string): Promise<void> {
    const draft = await this.findOne(id);

    // Don't allow deleting sent drafts
    if (draft.status === 'sent' || draft.status === 'sending') {
      throw new BadRequestException(
        `Cannot delete a draft that is ${draft.status}`,
      );
    }

    await this.messageDraftModel.findByIdAndDelete(id);
    this.logger.log(`Message draft ${id} deleted`);
  }

  /**
   * Preview a message with sample data
   */
  async preview(message: string): Promise<{
    preview: string;
    htmlPreview: string;
    availableVariables: string[];
  }> {
    const sampleData = {
      firstName: 'John',
      lastName: 'Doe',
    };

    const preview = this.replaceVariables(message, sampleData);
    const htmlPreview = this.generateEmailHtml(preview);

    return {
      preview,
      htmlPreview,
      availableVariables: ['{{firstName}}', '{{lastName}}'],
    };
  }

  /**
   * Send a draft immediately (manual trigger)
   */
  async sendNow(id: string): Promise<void> {
    const draft = await this.findOne(id);

    if (draft.status === 'sent') {
      throw new BadRequestException('This draft has already been sent');
    }

    if (draft.status === 'sending') {
      throw new BadRequestException('This draft is currently being sent');
    }

    await this.sendDraft(draft);
  }

  /**
   * Cron job to check and send scheduled drafts
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndSendScheduledDrafts(): Promise<void> {
    this.logger.log('Checking for scheduled message drafts to send...');

    const now = new Date();

    // Find drafts that are scheduled and due to be sent
    const draftsDue = await this.messageDraftModel.find({
      status: { $in: ['draft', 'scheduled'] },
      scheduledTime: { $lte: now },
    });

    this.logger.log(`Found ${draftsDue.length} draft(s) due to be sent`);

    for (const draft of draftsDue) {
      try {
        await this.sendDraft(draft);
      } catch (error) {
        this.logger.error(
          `Failed to send draft ${draft._id}: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Send a message draft to all first timers from the scheduled date
   */
  private async sendDraft(draft: MessageDraftDocument): Promise<void> {
    this.logger.log(`Sending message draft ${draft._id}...`);

    // Update status to sending
    await this.messageDraftModel.findByIdAndUpdate(draft._id, {
      status: 'sending',
    });

    try {
      // Get start and end of the scheduled date
      const startOfDay = new Date(draft.scheduledDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(draft.scheduledDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all first timers who registered on this date
      const firstTimers = await this.firstTimerModel.find({
        dateOfVisit: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        email: { $exists: true, $ne: null },
      });

      this.logger.log(
        `Found ${firstTimers.length} first timer(s) for ${draft.scheduledDate.toISOString().split('T')[0]}`,
      );

      let successCount = 0;
      let failedCount = 0;

      // Send emails to each first timer
      for (const firstTimer of firstTimers) {
        try {
          // Skip if no email address
          if (!firstTimer.email) {
            this.logger.warn(`Skipping first timer ${firstTimer._id} - no email address`);
            continue;
          }

          const personalizedMessage = this.replaceVariables(draft.message, {
            firstName: firstTimer.firstName,
            lastName: firstTimer.lastName,
          });

          const htmlContent = this.generateEmailHtml(personalizedMessage);

          await this.notificationsService.sendCustomEmail({
            to: firstTimer.email,
            subject: 'A Message from Our Church',
            html: htmlContent,
          });

          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to send email to ${firstTimer.email}: ${error.message}`,
          );
          failedCount++;
        }
      }

      // Update draft with results
      await this.messageDraftModel.findByIdAndUpdate(draft._id, {
        status: failedCount === 0 ? 'sent' : 'failed',
        sentAt: new Date(),
        recipientCount: firstTimers.length,
        successCount,
        failedCount,
        failureReason:
          failedCount > 0
            ? `${failedCount} out of ${firstTimers.length} emails failed`
            : undefined,
      });

      this.logger.log(
        `Draft ${draft._id} sent successfully. Success: ${successCount}, Failed: ${failedCount}`,
      );
    } catch (error) {
      // Update draft as failed
      await this.messageDraftModel.findByIdAndUpdate(draft._id, {
        status: 'failed',
        failureReason: error.message,
      });

      throw error;
    }
  }

  /**
   * Replace variables in message template
   */
  private replaceVariables(
    template: string,
    data: { firstName: string; lastName: string },
  ): string {
    return template
      .replace(/\{\{firstName\}\}/g, data.firstName)
      .replace(/\{\{lastName\}\}/g, data.lastName);
  }

  /**
   * Generate HTML email from plain message
   */
  private generateEmailHtml(message: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
              ${message}
            </div>
          </div>
          <div style="margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>Blessings,<br/>The Church Team</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Parse date and time strings into a Date object
   */
  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Generate default title for a message draft
   */
  private generateDefaultTitle(dateStr: string): string {
    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `First Timers Draft for ${formattedDate}`;
  }
}

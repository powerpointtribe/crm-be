import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  SendTestEmailDto,
} from './dto/message-draft.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  generateEmailHtml,
  getTemplatePreviewData,
  TemplateId,
} from './email-templates';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';

@Injectable()
export class MessageDraftsService {
  private readonly logger = new Logger(MessageDraftsService.name);

  constructor(
    @InjectModel(MessageDraft.name)
    private messageDraftModel: Model<MessageDraftDocument>,
    @InjectModel(FirstTimer.name)
    private firstTimerModel: Model<FirstTimerDocument>,
    private notificationsService: NotificationsService,
    private branchAccessService: BranchAccessService,
  ) {}

  /**
   * Get available email templates with preview HTML
   */
  getTemplates() {
    return getTemplatePreviewData();
  }

  /**
   * Create a new message draft
   */
  async create(
    createDto: CreateMessageDraftDto,
    userId: string,
    branchContext?: BranchFilterContext,
  ): Promise<MessageDraftDocument> {
    const scheduledDateTime = createDto.scheduledDate
      ? this.parseDateTime(createDto.scheduledDate, createDto.scheduledTime)
      : this.parseDateTime(
          new Date().toISOString().split('T')[0],
          createDto.scheduledTime,
        );

    const title =
      createDto.title ||
      this.generateDefaultTitle(
        createDto.scheduledDate || new Date().toISOString().split('T')[0],
      );

    let branchId: Types.ObjectId | undefined;
    if (createDto.branch) {
      branchId = new Types.ObjectId(createDto.branch);
    } else if (branchContext?.userBranchId) {
      branchId =
        typeof branchContext.userBranchId === 'string'
          ? new Types.ObjectId(branchContext.userBranchId)
          : branchContext.userBranchId;
    }

    const draft = await this.messageDraftModel.create({
      title,
      message: createDto.message,
      subject: createDto.subject || 'A Message from The PowerPoint Tribe',
      templateId: createDto.templateId || 1,
      recipientMode: createDto.recipientMode || 'by_date',
      recipientIds: createDto.recipientIds
        ? createDto.recipientIds.map((id) => new Types.ObjectId(id))
        : undefined,
      scheduledDate: createDto.scheduledDate
        ? new Date(createDto.scheduledDate)
        : undefined,
      scheduledTime: scheduledDateTime,
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
      branch: branchId,
    });

    this.logger.log(`Message draft created: ${draft._id}`);
    return draft;
  }

  /**
   * Get all message drafts with pagination
   */
  async findAll(
    query: MessageDraftQueryDto,
    branchContext?: BranchFilterContext,
  ): Promise<{
    drafts: MessageDraftDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    let filter: any = {};
    if (status) filter.status = status;

    if (branchContext) {
      filter = this.branchAccessService.applyBranchFilter(
        filter,
        branchContext,
        'branch',
      );
    }

    const [drafts, total] = await Promise.all([
      this.messageDraftModel
        .find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .populate('branch', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageDraftModel.countDocuments(filter),
    ]);

    return { drafts, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    if (!draft) throw new NotFoundException('Message draft not found');
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

    if (draft.status === 'sent' || draft.status === 'sending') {
      throw new BadRequestException(
        `Cannot edit a draft that is ${draft.status}`,
      );
    }

    const updateData: any = { updatedBy: userId };

    if (updateDto.title !== undefined) updateData.title = updateDto.title;
    if (updateDto.message !== undefined) updateData.message = updateDto.message;
    if (updateDto.subject !== undefined) updateData.subject = updateDto.subject;
    if (updateDto.templateId !== undefined)
      updateData.templateId = updateDto.templateId;
    if (updateDto.recipientMode !== undefined)
      updateData.recipientMode = updateDto.recipientMode;
    if (updateDto.recipientIds !== undefined)
      updateData.recipientIds = updateDto.recipientIds.map(
        (rid) => new Types.ObjectId(rid),
      );
    if (updateDto.branch !== undefined)
      updateData.branch = new Types.ObjectId(updateDto.branch);

    if (updateDto.scheduledDate !== undefined) {
      updateData.scheduledDate = new Date(updateDto.scheduledDate);
    }

    if (updateDto.scheduledTime !== undefined) {
      const dateStr =
        updateDto.scheduledDate ||
        draft.scheduledDate?.toISOString().split('T')[0] ||
        new Date().toISOString().split('T')[0];
      updateData.scheduledTime = this.parseDateTime(
        dateStr,
        updateDto.scheduledTime,
      );
    }

    const updated = await this.messageDraftModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true },
    );

    if (!updated) throw new NotFoundException('Message draft not found');

    this.logger.log(`Message draft ${id} updated`);
    return updated;
  }

  /**
   * Delete a message draft
   */
  async delete(id: string): Promise<void> {
    const draft = await this.findOne(id);

    if (draft.status === 'sent' || draft.status === 'sending') {
      throw new BadRequestException(
        `Cannot delete a draft that is ${draft.status}`,
      );
    }

    await this.messageDraftModel.findByIdAndDelete(id);
    this.logger.log(`Message draft ${id} deleted`);
  }

  /**
   * Preview a message with sample data using a template
   */
  async preview(
    message: string,
    templateId?: number,
    subject?: string,
  ): Promise<{
    preview: string;
    htmlPreview: string;
    availableVariables: string[];
  }> {
    const tId = (templateId || 1) as TemplateId;
    const sub = subject || 'Welcome to The PowerPoint Tribe';

    const personalizedBody = this.replaceVariables(message, {
      firstName: 'John',
      lastName: 'Doe',
    });

    const htmlPreview = generateEmailHtml(tId, {
      firstName: 'John',
      messageBody: personalizedBody,
      subject: sub,
    });

    return {
      preview: personalizedBody,
      htmlPreview,
      availableVariables: ['{{firstName}}', '{{lastName}}'],
    };
  }

  /**
   * Send a test email to any address
   */
  async sendTestEmail(dto: SendTestEmailDto): Promise<void> {
    const templateId = (dto.templateId || 1) as TemplateId;
    const subject = dto.subject
      ? `[Test] ${dto.subject}`
      : '[Test] A Message from The PowerPoint Tribe';

    const html = generateEmailHtml(templateId, {
      firstName: 'Friend',
      messageBody: dto.message,
      subject,
    });

    await this.notificationsService.sendCustomEmail({
      to: dto.email,
      subject,
      html,
    });

    this.logger.log(`Test email sent to ${dto.email}`);
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
   * Cron job to check and send scheduled drafts (every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndSendScheduledDrafts(): Promise<void> {
    this.logger.log('Checking for scheduled message drafts to send...');

    const now = new Date();
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
   * Core sending logic — supports both by_date and individual recipient modes
   */
  private async sendDraft(draft: MessageDraftDocument): Promise<void> {
    this.logger.log(`Sending message draft ${draft._id}...`);

    await this.messageDraftModel.findByIdAndUpdate(draft._id, {
      status: 'sending',
    });

    try {
      let firstTimers: FirstTimerDocument[];

      const recipientFilter: any = {
        email: { $exists: true, $ne: null },
      };

      if (draft.branch) {
        const branchId = draft.branch.toString();
        recipientFilter.branch = {
          $in: [draft.branch, branchId],
        };
      }

      if (draft.recipientMode === 'individual' && draft.recipientIds?.length) {
        firstTimers = await this.firstTimerModel.find({
          ...recipientFilter,
          _id: { $in: draft.recipientIds },
        });
      } else {
        if (!draft.scheduledDate) {
          throw new BadRequestException(
            'No service date set for by_date recipient mode',
          );
        }
        const startOfDay = new Date(draft.scheduledDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(draft.scheduledDate);
        endOfDay.setHours(23, 59, 59, 999);

        firstTimers = await this.firstTimerModel.find({
          ...recipientFilter,
          dateOfVisit: { $gte: startOfDay, $lte: endOfDay },
        });
      }

      this.logger.log(
        `Found ${firstTimers.length} recipient(s) for draft ${draft._id}`,
      );

      const templateId = (draft.templateId || 1) as TemplateId;
      const subject = draft.subject || 'A Message from The PowerPoint Tribe';
      let successCount = 0;
      let failedCount = 0;

      for (const ft of firstTimers) {
        try {
          if (!ft.email) continue;

          const personalizedBody = this.replaceVariables(draft.message, {
            firstName: ft.firstName,
            lastName: ft.lastName,
          });

          const html = generateEmailHtml(templateId, {
            firstName: ft.firstName,
            messageBody: personalizedBody,
            subject,
          });

          await this.notificationsService.sendCustomEmail({
            to: ft.email,
            subject,
            html,
          });

          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to send email to ${ft.email}: ${error.message}`,
          );
          failedCount++;
        }
      }

      const recipientsList = firstTimers
        .filter((ft) => ft.email)
        .map((ft) => ({
          firstName: ft.firstName,
          lastName: ft.lastName,
          email: ft.email,
        }));

      await this.messageDraftModel.findByIdAndUpdate(draft._id, {
        status: failedCount === 0 ? 'sent' : 'failed',
        sentAt: new Date(),
        recipientCount: firstTimers.length,
        successCount,
        failedCount,
        recipients: recipientsList,
        failureReason:
          failedCount > 0
            ? `${failedCount} out of ${firstTimers.length} emails failed`
            : undefined,
      });

      this.logger.log(
        `Draft ${draft._id} sent. Success: ${successCount}, Failed: ${failedCount}`,
      );
    } catch (error) {
      await this.messageDraftModel.findByIdAndUpdate(draft._id, {
        status: 'failed',
        failureReason: error.message,
      });
      throw error;
    }
  }

  private replaceVariables(
    template: string,
    data: { firstName: string; lastName: string },
  ): string {
    return template
      .replace(/\{\{firstName\}\}/g, data.firstName)
      .replace(/\{\{lastName\}\}/g, data.lastName);
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

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

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EmailCampaign,
  EmailCampaignDocument,
  CampaignStatus,
  RecipientFilterType,
} from './schemas/email-campaign.schema';
import { EmailSendLog, EmailSendLogDocument, EmailSendStatus } from './schemas/email-send-log.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import {
  CreateEmailCampaignDto,
  UpdateEmailCampaignDto,
  ScheduleCampaignDto,
} from './dto/create-email-campaign.dto';
import { CampaignQueryDto, SendLogQueryDto } from './dto/campaign-query.dto';

@Injectable()
export class EmailCampaignService {
  private readonly logger = new Logger(EmailCampaignService.name);

  constructor(
    @InjectModel(EmailCampaign.name)
    private emailCampaignModel: Model<EmailCampaignDocument>,
    @InjectModel(EmailSendLog.name)
    private emailSendLogModel: Model<EmailSendLogDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
  ) {}

  async create(
    createCampaignDto: CreateEmailCampaignDto,
    createdBy?: string,
  ): Promise<EmailCampaign> {
    const campaign = new this.emailCampaignModel({
      ...createCampaignDto,
      status: CampaignStatus.DRAFT,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });

    const savedCampaign = await campaign.save();
    this.logger.log(`Email campaign created: ${savedCampaign._id}`);
    return savedCampaign;
  }

  async findAll(query: CampaignQueryDto, branchId?: string) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      templateId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: any = {};

    // Branch filter
    const effectiveBranchId = query.branchId || branchId;
    if (effectiveBranchId) {
      filter.branch = new Types.ObjectId(effectiveBranchId);
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Template filter
    if (templateId) {
      filter.template = new Types.ObjectId(templateId);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await this.emailCampaignModel.countDocuments(filter);
    const items = await this.emailCampaignModel
      .find(filter)
      .populate('template', 'name category')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: string): Promise<EmailCampaign | null> {
    return this.emailCampaignModel
      .findById(id)
      .populate('branch', 'name')
      .populate('template', 'name category subject')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();
  }

  async findByIdWithStats(id: string) {
    const campaign = await this.emailCampaignModel
      .findById(id)
      .populate('branch', 'name')
      .populate('template', 'name category subject')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .lean()
      .exec();

    if (!campaign) {
      return null;
    }

    // Get detailed stats from send logs
    const statusCounts = await this.emailSendLogModel.aggregate([
      { $match: { campaign: new Types.ObjectId(id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const detailedStats = {
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      bounced: 0,
    };

    statusCounts.forEach((s) => {
      if (s._id in detailedStats) {
        detailedStats[s._id as keyof typeof detailedStats] = s.count;
      }
    });

    return {
      ...campaign,
      detailedStats,
    };
  }

  async update(
    id: string,
    updateCampaignDto: UpdateEmailCampaignDto,
    updatedBy?: string,
  ): Promise<EmailCampaign> {
    const campaign = await this.emailCampaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Only allow updates to draft campaigns
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Can only update draft campaigns');
    }

    const updateData = {
      ...updateCampaignDto,
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
    };

    const updatedCampaign = await this.emailCampaignModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('template', 'name category')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found after update`);
    }

    this.logger.log(`Email campaign updated: ${id}`);
    return updatedCampaign;
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.emailCampaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Only allow deletion of draft or cancelled campaigns
    if (![CampaignStatus.DRAFT, CampaignStatus.CANCELLED].includes(campaign.status)) {
      throw new BadRequestException('Can only delete draft or cancelled campaigns');
    }

    // Delete associated send logs
    await this.emailSendLogModel.deleteMany({ campaign: new Types.ObjectId(id) });

    await this.emailCampaignModel.findByIdAndDelete(id);
    this.logger.log(`Email campaign deleted: ${id}`);
  }

  async scheduleCampaign(
    id: string,
    scheduleDto: ScheduleCampaignDto,
    updatedBy?: string,
  ): Promise<EmailCampaign> {
    const campaign = await this.emailCampaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Can only schedule draft campaigns');
    }

    // Validate scheduled date is in the future
    if (scheduleDto.scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled date must be in the future');
    }

    // Get recipient count
    const recipients = await this.getRecipients(campaign);

    const updatedCampaign = await this.emailCampaignModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: CampaignStatus.SCHEDULED,
            scheduledAt: scheduleDto.scheduledAt,
            'stats.totalRecipients': recipients.length,
            updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found after scheduling`);
    }

    this.logger.log(`Email campaign scheduled: ${id} for ${scheduleDto.scheduledAt}`);
    return updatedCampaign;
  }

  async cancelCampaign(id: string, updatedBy?: string): Promise<EmailCampaign> {
    const campaign = await this.emailCampaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    if (campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException('Can only cancel scheduled campaigns');
    }

    const updatedCampaign = await this.emailCampaignModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: CampaignStatus.CANCELLED,
            updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedCampaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found after cancellation`);
    }

    this.logger.log(`Email campaign cancelled: ${id}`);
    return updatedCampaign;
  }

  async previewRecipients(id: string, limit: number = 10) {
    const campaign = await this.emailCampaignModel.findById(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    const recipients = await this.getRecipients(campaign, limit);
    const totalCount = await this.getRecipientCount(campaign);

    return {
      recipients,
      totalCount,
      previewLimit: limit,
    };
  }

  async getSendLogs(campaignId: string, query: SendLogQueryDto) {
    const { page = 1, limit = 50, status, email, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const filter: any = { campaign: new Types.ObjectId(campaignId) };

    if (status) {
      filter.status = status;
    }

    if (email) {
      filter.email = { $regex: email, $options: 'i' };
    }

    const total = await this.emailSendLogModel.countDocuments(filter);
    const items = await this.emailSendLogModel
      .find(filter)
      .populate('member', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getStatistics(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);

    const [totalCampaigns, statusBreakdown, recentCampaigns, deliveryStats] = await Promise.all([
      this.emailCampaignModel.countDocuments({ branch: branchObjectId }),
      this.emailCampaignModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.emailCampaignModel
        .find({ branch: branchObjectId, status: CampaignStatus.SENT })
        .sort({ sentAt: -1 })
        .limit(5)
        .select('name subject sentAt stats')
        .exec(),
      this.emailCampaignModel.aggregate([
        { $match: { branch: branchObjectId, status: CampaignStatus.SENT } },
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$stats.sent' },
            totalDelivered: { $sum: '$stats.delivered' },
            totalFailed: { $sum: '$stats.failed' },
            totalOpened: { $sum: '$stats.opened' },
            totalClicked: { $sum: '$stats.clicked' },
          },
        },
      ]),
    ]);

    const statusMap: Record<string, number> = {};
    statusBreakdown.forEach((s) => {
      statusMap[s._id] = s.count;
    });

    return {
      totalCampaigns,
      statusBreakdown: statusMap,
      recentCampaigns,
      deliveryStats: deliveryStats[0] || {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalOpened: 0,
        totalClicked: 0,
      },
    };
  }

  /**
   * Get recipients based on campaign filter
   */
  async getRecipients(
    campaign: EmailCampaignDocument,
    limit?: number,
  ): Promise<MemberDocument[]> {
    const filter = await this.buildRecipientFilter(campaign);

    let query = this.memberModel
      .find(filter)
      .select('firstName lastName email phone branch district unit membershipStatus');

    if (limit) {
      query = query.limit(limit);
    }

    return query.exec();
  }

  async getRecipientCount(campaign: EmailCampaignDocument): Promise<number> {
    const filter = await this.buildRecipientFilter(campaign);
    return this.memberModel.countDocuments(filter);
  }

  private async buildRecipientFilter(campaign: EmailCampaignDocument): Promise<any> {
    const filter: any = {
      isActive: true, // Only active members
      email: { $exists: true, $ne: '' }, // Must have email
    };

    const recipientFilter = campaign.recipientFilter;

    switch (recipientFilter.filterType) {
      case RecipientFilterType.ALL_MEMBERS:
        filter.branch = campaign.branch;
        break;

      case RecipientFilterType.BY_BRANCH:
        if (recipientFilter.branchIds?.length) {
          filter.branch = { $in: recipientFilter.branchIds.map((id) => new Types.ObjectId(id)) };
        } else {
          filter.branch = campaign.branch;
        }
        break;

      case RecipientFilterType.BY_GROUP:
        if (recipientFilter.groupIds?.length) {
          filter.$or = [
            { additionalGroups: { $in: recipientFilter.groupIds.map((id) => new Types.ObjectId(id)) } },
          ];
        }
        filter.branch = campaign.branch;
        break;

      case RecipientFilterType.BY_UNIT:
        if (recipientFilter.unitIds?.length) {
          filter.unit = { $in: recipientFilter.unitIds.map((id) => new Types.ObjectId(id)) };
        }
        filter.branch = campaign.branch;
        break;

      case RecipientFilterType.BY_DISTRICT:
        if (recipientFilter.districtIds?.length) {
          filter.district = { $in: recipientFilter.districtIds.map((id) => new Types.ObjectId(id)) };
        }
        filter.branch = campaign.branch;
        break;

      case RecipientFilterType.BY_MEMBERSHIP_STATUS:
        if (recipientFilter.membershipStatuses?.length) {
          filter.membershipStatus = { $in: recipientFilter.membershipStatuses };
        }
        filter.branch = campaign.branch;
        break;

      case RecipientFilterType.CUSTOM:
        if (recipientFilter.customMemberIds?.length) {
          filter._id = { $in: recipientFilter.customMemberIds.map((id) => new Types.ObjectId(id)) };
        } else {
          // No custom members selected, return empty
          filter._id = { $in: [] };
        }
        break;

      default:
        filter.branch = campaign.branch;
    }

    return filter;
  }

  /**
   * Mark campaign as sending (called by queue processor)
   */
  async markAsSending(campaignId: string): Promise<void> {
    await this.emailCampaignModel.findByIdAndUpdate(campaignId, {
      $set: { status: CampaignStatus.SENDING, sentAt: new Date() },
    });
  }

  /**
   * Mark campaign as sent (called by queue processor)
   */
  async markAsSent(campaignId: string): Promise<void> {
    await this.emailCampaignModel.findByIdAndUpdate(campaignId, {
      $set: { status: CampaignStatus.SENT, completedAt: new Date() },
    });
  }

  /**
   * Mark campaign as failed (called by queue processor)
   */
  async markAsFailed(campaignId: string): Promise<void> {
    await this.emailCampaignModel.findByIdAndUpdate(campaignId, {
      $set: { status: CampaignStatus.FAILED },
    });
  }

  /**
   * Update campaign stats (called by queue processor)
   */
  async updateStats(
    campaignId: string,
    statUpdate: Partial<{ sent: number; delivered: number; failed: number }>,
  ): Promise<void> {
    const updateQuery: any = {};
    if (statUpdate.sent) updateQuery['stats.sent'] = statUpdate.sent;
    if (statUpdate.delivered) updateQuery['stats.delivered'] = statUpdate.delivered;
    if (statUpdate.failed) updateQuery['stats.failed'] = statUpdate.failed;

    await this.emailCampaignModel.findByIdAndUpdate(campaignId, { $inc: updateQuery });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import {
  SubmissionQueryDto,
  SubscriptionQueryDto,
  UpdateSubmissionDto,
} from '../dto/inbox.dto';
import {
  WebFormSubmission,
  WebFormSubmissionDocument,
  WebSubscription,
  WebSubscriptionDocument,
} from '../schemas/web-form-submission.schema';
import { containsRegex } from '../utils/text.util';

/** Neutralise spreadsheet formulas (CSV injection) and quote the cell. */
export function csvCell(
  value: string | number | boolean | null | undefined,
): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const MAX_EXPORT = 50_000;

/** Staff side of the website inbox and sign-ups. */
@Injectable()
export class WebsiteInboxService {
  constructor(
    @InjectModel(WebFormSubmission.name)
    private readonly submissions: Model<WebFormSubmissionDocument>,
    @InjectModel(WebSubscription.name)
    private readonly subscriptions: Model<WebSubscriptionDocument>,
  ) {}

  async list(q: SubmissionQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter: FilterQuery<WebFormSubmission> = {};
    if (q.formType) filter.formType = q.formType;
    if (q.status) filter.status = q.status;
    if (q.branch) filter.branch = new Types.ObjectId(q.branch);
    if (q.search?.trim()) {
      const rx = containsRegex(q.search);
      filter.$or = [
        { 'contact.name': rx },
        { 'contact.email': rx },
        { 'contact.phone': rx },
      ];
    }
    const [data, total] = await Promise.all([
      this.submissions
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'name slug')
        .populate('assignedTo', 'firstName lastName email')
        .lean()
        .exec(),
      this.submissions.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  /** Counts per form type and status, for the inbox tabs and dashboard. */
  async summary() {
    return this.submissions
      .aggregate<{
        formType: string;
        status: string;
        count: number;
      }>([
        {
          $group: {
            _id: { formType: '$formType', status: '$status' },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            formType: '$_id.formType',
            status: '$_id.status',
            count: 1,
          },
        },
        { $sort: { formType: 1, status: 1 } },
      ])
      .exec();
  }

  async get(id: string) {
    if (!isValidObjectId(id))
      throw new NotFoundException('Submission not found');
    const doc = await this.submissions
      .findById(id)
      .populate('branch', 'name slug')
      .populate('assignedTo', 'firstName lastName email')
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Submission not found');
    return doc;
  }

  async update(id: string, dto: UpdateSubmissionDto, actorId?: Types.ObjectId) {
    if (!isValidObjectId(id))
      throw new NotFoundException('Submission not found');
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.notes !== undefined) set.notes = dto.notes;
    if (dto.assignedTo !== undefined) {
      set.assignedTo = dto.assignedTo
        ? new Types.ObjectId(dto.assignedTo)
        : null;
    }
    const doc = await this.submissions
      .findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Submission not found');
    return doc;
  }

  async remove(id: string) {
    if (!isValidObjectId(id))
      throw new NotFoundException('Submission not found');
    const res = await this.submissions.deleteOne({ _id: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Submission not found');
  }

  private subscriptionFilter(q: SubscriptionQueryDto) {
    const filter: FilterQuery<WebSubscription> = {};
    if (q.list) filter.list = q.list;
    if (q.channel) filter.channel = q.channel;
    if (q.search?.trim()) filter.address = containsRegex(q.search);
    return filter;
  }

  async listSubscriptions(q: SubscriptionQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter = this.subscriptionFilter(q);
    const [data, total] = await Promise.all([
      this.subscriptions
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.subscriptions.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async exportSubscriptionsCsv(q: SubscriptionQueryDto) {
    const rows = await this.subscriptions
      .find(this.subscriptionFilter(q))
      .sort({ createdAt: 1 })
      .limit(MAX_EXPORT)
      .lean()
      .exec();
    const header = ['List', 'Channel', 'Address', 'Status', 'Signed up'];
    const lines = rows.map((r) =>
      [
        r.list,
        r.channel,
        r.address,
        r.status,
        (r as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
    return {
      csv: [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n',
      count: rows.length,
    };
  }
}

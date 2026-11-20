import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { createPaginatedResult } from '../common/utils/pagination.util';
import {
  UpdateEventWebsiteDto,
  WebsiteEventsQueryDto,
} from './dto/event-website.dto';
import {
  Event,
  EventDocument,
  EventStatus,
  WebsiteEventKind,
} from './schemas/event.schema';

const DEFAULT_TZ = 'Africa/Lagos';

/**
 * Events on the public website. Only events staff opted in
 * (website.showOnWebsite) that are published. One-off events are listed only
 * until they end.
 */
@Injectable()
export class EventsWebsiteService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  private baseFilter(kind: WebsiteEventKind, now: Date): FilterQuery<Event> {
    const filter: FilterQuery<Event> = {
      status: EventStatus.PUBLISHED,
      'website.showOnWebsite': true,
      'website.kind': kind,
    };
    if (kind === WebsiteEventKind.ONE_OFF) filter.endDate = { $gte: now };
    return filter;
  }

  async list(q: WebsiteEventsQueryDto, now = new Date()) {
    const kind = q.kind ?? WebsiteEventKind.ONE_OFF;
    const page = q.page ?? 1;
    const limit = q.limit ?? 8;
    const base = this.baseFilter(kind, now);
    const filter: FilterQuery<Event> = { ...base };
    if (q.branch) {
      const branch = await this.branchModel
        .findOne({ slug: q.branch })
        .select('_id')
        .lean()
        .exec();
      // A campus filter also includes events for every campus.
      filter.$or = [
        ...(branch ? [{ branch: branch._id }] : []),
        { isGlobal: true },
        { branch: null },
      ];
    }
    const [docs, total, anywhere] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ startDate: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'slug name timezone')
        .lean()
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
      q.branch
        ? this.eventModel.countDocuments(base).exec()
        : Promise.resolve(-1),
    ]);
    return {
      events: createPaginatedResult(
        docs.map((d) => this.shape(d)),
        total,
        page,
        limit,
      ),
      // True when nothing is upcoming at ANY campus (even with a campus filter).
      empty: (q.branch ? anywhere : total) === 0,
    };
  }

  /** Featured first, then the soonest upcoming one-off event. */
  async next(now = new Date()) {
    const doc = await this.eventModel
      .findOne(this.baseFilter(WebsiteEventKind.ONE_OFF, now))
      .sort({ 'website.featured': -1, startDate: 1, _id: 1 })
      .populate('branch', 'slug name timezone')
      .lean()
      .exec();
    return { event: doc ? this.shape(doc) : null };
  }

  async updateWebsite(id: string, dto: UpdateEventWebsiteDto) {
    if (!isValidObjectId(id)) return null;
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) set[`website.${k}`] = v;
    }
    if (!Object.keys(set).length) {
      return this.eventModel.findById(id).lean().exec();
    }
    return this.eventModel
      .findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true })
      .lean()
      .exec();
  }

  /**
   * Public projection. startsAt/endsAt are the stored startDate/endDate
   * instants; startTime/endTime are passed through for display.
   */
  private shape(d: Record<string, any>) {
    const branch =
      d.branch && !(d.branch instanceof Types.ObjectId) && 'slug' in d.branch
        ? (d.branch as { slug: string; name: string; timezone?: string })
        : null;
    return {
      _id: d._id,
      slug: d.registrationSlug ?? String(d._id),
      title: d.title,
      kind: d.website?.kind ?? WebsiteEventKind.ONE_OFF,
      typeLabel: d.website?.typeLabel ?? null,
      featured: !!d.website?.featured,
      startsAt: d.startDate,
      endsAt: d.endDate ?? null,
      startTime: d.startTime ?? null,
      endTime: d.endTime ?? null,
      timezone: branch?.timezone ?? DEFAULT_TZ,
      image: d.bannerImage ?? null,
      description: d.description ?? null,
      link: d.website?.link ?? d.websiteUrl ?? null,
      location: d.location
        ? {
            name: d.location.name || null,
            address: d.location.address || null,
            city: d.location.city || null,
            isVirtual: !!d.location.isVirtual,
          }
        : null,
      branch: branch ? { slug: branch.slug, name: branch.name } : null,
    };
  }
}

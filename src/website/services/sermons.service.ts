import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import {
  PublicSeriesPartsQueryDto,
  PublicSermonQueryDto,
} from '../dto/public-query.dto';
import { publishedFilter } from '../schemas/publishing';
import { WebSeries, WebSeriesDocument } from '../schemas/web-series.schema';
import { WebSermon, WebSermonDocument } from '../schemas/web-sermon.schema';
import { csv, containsRegex } from '../utils/text.util';
import {
  orNull,
  publicBranch,
  publicSeriesRef,
} from '../utils/public-shape.util';
import { ContentStore } from './content-store';

const BRANCH_FIELDS = 'slug name';
const SERIES_FIELDS = 'slug title status publishAt';

@Injectable()
export class WebSermonsService {
  readonly sermons: ContentStore<WebSermon>;
  readonly series: ContentStore<WebSeries>;

  constructor(
    @InjectModel(WebSermon.name)
    private readonly sermonModel: Model<WebSermonDocument>,
    @InjectModel(WebSeries.name)
    private readonly seriesModel: Model<WebSeriesDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {
    this.sermons = new ContentStore<WebSermon>(sermonModel, {
      searchFields: ['title', 'speaker'],
      sort: { date: -1 },
      slugFrom: 'title',
    });
    this.series = new ContentStore<WebSeries>(seriesModel, {
      searchFields: ['title'],
      sort: { startDate: -1 },
      slugFrom: 'title',
    });
  }

  // ─── Public ──────────────────────────────────────────────────────────

  async publicList(q: PublicSermonQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 8;
    const and: FilterQuery<WebSermon>[] = [publishedFilter<WebSermon>()];

    const services = csv(q.service);
    if (services.length) and.push({ service: { $in: services } });

    const slugs = csv(q.branch);
    if (slugs.length) {
      const ids = await this.branchIds(slugs);
      // Unknown campus slugs match nothing (not "everything").
      and.push({ branch: { $in: ids } });
    }

    if (q.search?.trim()) {
      const rx = containsRegex(q.search);
      const seriesIds = await this.seriesModel
        .find({ title: rx })
        .distinct('_id')
        .exec();
      and.push({
        $or: [{ title: rx }, { speaker: rx }, { series: { $in: seriesIds } }],
      });
    }

    const sort: Record<string, SortOrder> =
      q.sort === 'oldest'
        ? { date: 1, _id: 1 }
        : q.sort === 'az'
          ? { title: 1, _id: 1 }
          : { date: -1, _id: -1 };

    const filter = { $and: and } as FilterQuery<WebSermon>;
    const [docs, total] = await Promise.all([
      this.sermonModel
        .find(filter)
        .collation({ locale: 'en', strength: 2 })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', BRANCH_FIELDS)
        .populate('series', SERIES_FIELDS)
        .lean()
        .exec(),
      this.sermonModel.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(
      docs.map((d) => this.shape(d)),
      total,
      page,
      limit,
    );
  }

  async publicLatest() {
    const doc = await this.sermonModel
      .findOne(publishedFilter<WebSermon>())
      .sort({ date: -1, _id: -1 })
      .populate('branch', BRANCH_FIELDS)
      .populate('series', SERIES_FIELDS)
      .lean()
      .exec();
    // There is no YouTube live lookup yet (decision Q12): always not live.
    return {
      sermon: doc ? this.shape(doc) : null,
      live: { isLive: false, videoId: null },
    };
  }

  async publicSeriesList(page = 1, limit = 3) {
    const filter = publishedFilter<WebSeries>();
    const [docs, total] = await Promise.all([
      this.seriesModel
        .find(filter)
        .sort({ startDate: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.seriesModel.countDocuments(filter).exec(),
    ]);
    const counts = await this.partsCounts(docs.map((d) => d._id));
    return createPaginatedResult(
      docs.map((d) => this.shapeSeries(d, counts.get(String(d._id)) ?? 0)),
      total,
      page,
      limit,
    );
  }

  async publicSeries(slug: string, q: PublicSeriesPartsQueryDto) {
    const series = await this.seriesModel
      .findOne({ ...publishedFilter<WebSeries>(), slug: slug.toLowerCase() })
      .lean()
      .exec();
    if (!series) throw new NotFoundException(`Series "${slug}" not found`);

    const page = q.page ?? 1;
    const limit = q.limit ?? 8;
    const filter = {
      $and: [publishedFilter<WebSermon>(), { series: series._id }],
    } as FilterQuery<WebSermon>;
    const dir = q.sort === 'newest' ? -1 : 1;
    const [docs, total] = await Promise.all([
      this.sermonModel
        .find(filter)
        .sort({ partNumber: dir, date: dir, _id: dir })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', BRANCH_FIELDS)
        .populate('series', SERIES_FIELDS)
        .lean()
        .exec(),
      this.sermonModel.countDocuments(filter).exec(),
    ]);
    return {
      series: this.shapeSeries(series, total),
      parts: createPaginatedResult(
        docs.map((d) => this.shape(d)),
        total,
        page,
        limit,
      ),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async branchIds(slugs: string[]): Promise<Types.ObjectId[]> {
    return this.branchModel
      .find({ slug: { $in: slugs } })
      .distinct('_id')
      .exec() as Promise<Types.ObjectId[]>;
  }

  /** Published sermons per series id. */
  private async partsCounts(ids: Types.ObjectId[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.sermonModel
      .aggregate<{
        _id: Types.ObjectId;
        n: number;
      }>([
        { $match: { ...publishedFilter<WebSermon>(), series: { $in: ids } } },
        { $group: { _id: '$series', n: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((r) => [String(r._id), r.n]));
  }

  private shape(d: Record<string, any>) {
    return {
      _id: d._id,
      slug: d.slug,
      title: d.title,
      date: d.date,
      service: d.service,
      speaker: d.speaker,
      youtubeId: orNull(d.youtubeId),
      audioUrl: orNull(d.audioUrl),
      thumbnailUrl: orNull(d.thumbnailUrl),
      durationMin: orNull(d.durationMin),
      partNumber: orNull(d.partNumber),
      branch: publicBranch(d.branch),
      series: publicSeriesRef(d.series),
    };
  }

  private shapeSeries(d: Record<string, any>, partsCount: number) {
    return {
      _id: d._id,
      slug: d.slug,
      title: d.title,
      artworkUrl: orNull(d.artworkUrl),
      artworkAlt: orNull(d.artworkAlt),
      description: orNull(d.description),
      serviceLabel: orNull(d.serviceLabel),
      speaker: orNull(d.speaker),
      startDate: d.startDate,
      partsCount,
    };
  }
}

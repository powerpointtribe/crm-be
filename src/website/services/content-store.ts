import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  FilterQuery,
  isValidObjectId,
  Model,
  SortOrder,
  Types,
} from 'mongoose';
import {
  createPaginatedResult,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { containsRegex, escapeRegex, slugify } from '../utils/text.util';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ContentStoreOptions {
  /** Fields matched by the staff `search` param (case-insensitive contains). */
  searchFields: string[];
  /** Default staff list sort. */
  sort: Record<string, SortOrder>;
  /** Field the slug is generated from, for slugged collections. */
  slugFrom?: string;
}

/** Mongo duplicate-key error (E11000). */
const isDuplicateKey = (err: unknown) =>
  (err as { code?: number } | null)?.code === 11000;

/**
 * Shared CRUD for website content collections (staff side). Public reads live
 * in each resource's service because each has its own shape and filters.
 */
export class ContentStore<T> {
  constructor(
    // Model<TDocument> (InjectModel's type) isn't assignable to Model<T>, so
    // accept the injected model as-is; T only types what we return.
    readonly model: Model<any>,
    private readonly options: ContentStoreOptions,
  ) {}

  async list(
    params: ListParams,
    filter: FilterQuery<T> = {},
    populate: string[] = [],
  ): Promise<PaginatedResult<T>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query: FilterQuery<T> = { ...filter };
    if (params.search?.trim()) {
      const rx = containsRegex(params.search);
      (query as Record<string, unknown>).$or = this.options.searchFields.map(
        (f) => ({ [f]: rx }),
      );
    }
    let find = this.model
      .find(query)
      .sort(this.options.sort)
      .skip((page - 1) * limit)
      .limit(limit);
    for (const path of populate) find = find.populate(path);
    const [data, total] = await Promise.all([
      find.lean<T[]>().exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string, populate: string[] = []): Promise<T> {
    if (!isValidObjectId(id)) throw this.notFound();
    let find = this.model.findById(id);
    for (const path of populate) find = find.populate(path);
    const doc = await find.lean<T>().exec();
    if (!doc) throw this.notFound();
    return doc;
  }

  async create(dto: Partial<T> & { slug?: string }, actorId?: Types.ObjectId) {
    const data: Record<string, unknown> = {
      ...dto,
      createdBy: actorId,
      updatedBy: actorId,
    };
    if (this.options.slugFrom) {
      data.slug = dto.slug
        ? slugify(dto.slug)
        : await this.freeSlug(this.slugSource(dto));
    }
    try {
      const doc = await this.model.create(data);
      return doc.toObject() as T;
    } catch (err) {
      if (isDuplicateKey(err)) throw this.slugTaken();
      throw err;
    }
  }

  async update(
    id: string,
    dto: Partial<T> & { slug?: string },
    actorId?: Types.ObjectId,
  ): Promise<T> {
    if (!isValidObjectId(id)) throw this.notFound();
    const data: Record<string, unknown> = { ...dto, updatedBy: actorId };
    if (this.options.slugFrom && dto.slug !== undefined) {
      data.slug = slugify(dto.slug);
    }
    try {
      const doc = await this.model
        .findByIdAndUpdate(
          id,
          { $set: data },
          { new: true, runValidators: true },
        )
        .lean<T>()
        .exec();
      if (!doc) throw this.notFound();
      return doc;
    } catch (err) {
      if (isDuplicateKey(err)) throw this.slugTaken();
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) throw this.notFound();
    const res = await this.model
      .deleteOne({ _id: id } as FilterQuery<T>)
      .exec();
    if (res.deletedCount === 0) throw this.notFound();
  }

  private slugSource(dto: object): string {
    const v = (dto as Record<string, unknown>)[this.options.slugFrom ?? ''];
    return typeof v === 'string' ? v : '';
  }

  /** `base`, or `base-2`, `base-3`... whichever is free. */
  private async freeSlug(source: string): Promise<string> {
    const base = slugify(source);
    const taken = await this.model
      .find({
        slug: new RegExp(`^${escapeRegex(base)}(-\\d+)?$`),
      } as FilterQuery<T>)
      .select('slug')
      .lean<{ slug: string }[]>()
      .exec();
    const used = new Set(taken.map((d) => d.slug));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) {
      if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
    }
  }

  private notFound() {
    return new NotFoundException('Not found');
  }

  private slugTaken() {
    return new ConflictException(
      'That web address (slug) is already used. Choose a different one.',
    );
  }
}

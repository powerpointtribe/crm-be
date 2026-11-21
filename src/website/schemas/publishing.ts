import { FilterQuery } from 'mongoose';

/** Publishing state shared by every website content collection. */
export enum PublishStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

/**
 * What the public may see: published, and either no `publishAt` or a
 * `publishAt` that has passed (scheduled publishing).
 */
export function publishedFilter<T>(now = new Date()): FilterQuery<T> {
  return {
    status: PublishStatus.PUBLISHED,
    $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
  } as FilterQuery<T>;
}

import { Types } from 'mongoose';

/*
 * Public projections: only the fields the website needs, never staff fields
 * (createdBy, updatedBy, member links, approval flags).
 */

type Ref<T> = Types.ObjectId | T | null | undefined;
type BranchRef = { _id: Types.ObjectId; slug?: string; name?: string };

/** Populated branch → `{ slug, name }`; unpopulated or missing → null. */
export function publicBranch(ref: Ref<BranchRef>) {
  if (!ref || ref instanceof Types.ObjectId || !('slug' in ref)) return null;
  return { slug: ref.slug ?? null, name: ref.name ?? null };
}

/** Populated series → `{ slug, title }` only if that series is public. */
export function publicSeriesRef(
  ref: Ref<{
    _id: Types.ObjectId;
    slug?: string;
    title?: string;
    status?: string;
    publishAt?: Date | null;
  }>,
  now = new Date(),
) {
  if (!ref || ref instanceof Types.ObjectId || !('slug' in ref)) return null;
  const visible =
    ref.status === 'published' && (!ref.publishAt || ref.publishAt <= now);
  return visible ? { slug: ref.slug, title: ref.title } : null;
}

export const orNull = <T>(v: T | undefined | null): T | null => v ?? null;

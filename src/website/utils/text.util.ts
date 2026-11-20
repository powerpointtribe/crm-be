/** Escape user input for use inside a RegExp (prevents regex injection / ReDoS). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" regex for a trimmed, length-capped search term. */
export function containsRegex(input: string, max = 100): RegExp {
  return new RegExp(escapeRegex(input.trim().slice(0, max)), 'i');
}

/**
 * URL slug from a title: lowercase ASCII words joined by "-".
 * "The Law of Clarity (Pt. 2)" -> "the-law-of-clarity-pt-2"
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'item';
}

/** Split a comma list / repeated query param into trimmed, non-empty values. */
export function csv(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) =>
    String(v).split(','),
  );
  return [...new Set(parts.map((v) => v.trim()).filter(Boolean))];
}

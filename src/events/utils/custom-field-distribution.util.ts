// ─────────────────────────────────────────────────────────────────────────
//  CUSTOM-FIELD DISTRIBUTION
//
//  Aggregates a registration custom-field response into a ranked distribution,
//  e.g. "school distribution" (university) or "how did you hear about us".
//
//  Tolerates the naming drift between the event seeder and the live form: the
//  CMIT site submits `university` / `howDidYouHear`, while the seeded event
//  defines the field id as `heardAbout`. Pass all candidate keys and the first
//  non-empty one per registration wins.
// ─────────────────────────────────────────────────────────────────────────

export interface FieldDistribution {
  total: number;
  distribution: { value: string; count: number }[];
}

type RegistrationLike = {
  customFieldResponses?:
    | Record<string, unknown>
    | Map<string, unknown>
    | null;
};

/** Candidate keys for the "school / university" field. */
export const SCHOOL_FIELD_KEYS = ['university', 'school'];

/** Candidate keys for the "how did you hear about us" field. */
export const HEARD_ABOUT_FIELD_KEYS = [
  'howDidYouHear',
  'heardAbout',
  'howHeard',
];

/**
 * Canonical labels for referral answers, keyed by the lowercased response.
 * Folds the legacy "Instagram" option into the current "Instagram / Meta"
 * label so the rename doesn't split the bar in two. (Facebook stays its own
 * option, matching the registration dropdown.)
 */
export const HEARD_ABOUT_ALIASES: Record<string, string> = {
  instagram: 'Instagram / Meta',
  meta: 'Instagram / Meta',
  'instagram / meta': 'Instagram / Meta',
};

function readField(
  cfr: Record<string, unknown> | Map<string, unknown> | null | undefined,
  keys: string[],
): unknown {
  if (!cfr) return undefined;
  for (const key of keys) {
    const value = cfr instanceof Map ? cfr.get(key) : (cfr as any)[key];
    if (value != null && String(value).trim() !== '') return value;
  }
  return undefined;
}

/**
 * Build a ranked distribution (highest count first) of a custom-field response
 * across a set of registrations. Multi-select answers (comma-separated) are
 * split and counted individually; grouping is case-insensitive while the
 * first-seen spelling is preserved for display.
 */
export function buildDistribution(
  registrations: RegistrationLike[],
  keys: string[],
  aliases?: Record<string, string>,
): FieldDistribution {
  const counts = new Map<string, { label: string; count: number }>();
  let total = 0;

  for (const reg of registrations) {
    const raw = readField(reg?.customFieldResponses, keys);
    if (raw == null) continue;
    String(raw)
      .split(/\s*,\s*/)
      .forEach((part) => {
        let value = part.trim();
        if (!value) return;
        // Collapse known synonyms to a canonical label before counting.
        const canonical = aliases?.[value.toLowerCase()];
        if (canonical) value = canonical;
        const norm = value.toLowerCase();
        const existing = counts.get(norm);
        if (existing) existing.count += 1;
        else counts.set(norm, { label: value, count: 1 });
        total += 1;
      });
  }

  const distribution = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .map((x) => ({ value: x.label, count: x.count }));

  return { total, distribution };
}

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

/**
 * Canonical school names keyed by the lowercased response. Folds common
 * abbreviations and shorthand (e.g. "unilag", "oau", "ui") into the full
 * institution name so analytics group them together regardless of how each
 * registrant typed it. Grouping is already case-insensitive (see
 * buildDistribution), so these only need to cover genuine synonyms, not casing.
 *
 * Keep the canonical values in sync with cmit/src/data/schools.js so the
 * searchable dropdown on the registration form and these analytics agree.
 */
export const SCHOOL_ALIASES: Record<string, string> = {
  // Federal universities
  ui: 'University of Ibadan',
  'uni ibadan': 'University of Ibadan',
  unilag: 'University of Lagos',
  'uni lagos': 'University of Lagos',
  oau: 'Obafemi Awolowo University',
  ife: 'Obafemi Awolowo University',
  'great ife': 'Obafemi Awolowo University',
  unn: 'University of Nigeria, Nsukka',
  nsukka: 'University of Nigeria, Nsukka',
  abu: 'Ahmadu Bello University',
  'abu zaria': 'Ahmadu Bello University',
  uniben: 'University of Benin',
  unilorin: 'University of Ilorin',
  unijos: 'University of Jos',
  uniuyo: 'University of Uyo',
  uniport: 'University of Port Harcourt',
  uniph: 'University of Port Harcourt',
  unical: 'University of Calabar',
  buk: 'Bayero University, Kano',
  bayero: 'Bayero University, Kano',
  uniabuja: 'University of Abuja',
  unimaid: 'University of Maiduguri',
  udus: 'Usmanu Danfodiyo University, Sokoto',
  futa: 'Federal University of Technology, Akure',
  futo: 'Federal University of Technology, Owerri',
  futminna: 'Federal University of Technology, Minna',
  'fut minna': 'Federal University of Technology, Minna',
  funaab: 'Federal University of Agriculture, Abeokuta',
  unizik: 'Nnamdi Azikiwe University',
  nau: 'Nnamdi Azikiwe University',
  fuoye: 'Federal University, Oye-Ekiti',
  mouau: 'Michael Okpara University of Agriculture, Umudike',
  fupre: 'Federal University of Petroleum Resources, Effurun',
  nda: 'Nigerian Defence Academy',
  // State universities
  lasu: 'Lagos State University',
  eksu: 'Ekiti State University',
  rsu: 'Rivers State University',
  rust: 'Rivers State University',
  lautech: 'Ladoke Akintola University of Technology',
  oou: 'Olabisi Onabanjo University',
  esut: 'Enugu State University of Science and Technology',
  delsu: 'Delta State University',
  aau: 'Ambrose Alli University',
  kwasu: 'Kwara State University',
  imsu: 'Imo State University',
  absu: 'Abia State University',
  bsu: 'Benue State University',
  kasu: 'Kaduna State University',
  ebsu: 'Ebonyi State University',
  tasued: 'Tai Solarin University of Education',
  // Private universities
  cu: 'Covenant University',
  covenant: 'Covenant University',
  babcock: 'Babcock University',
  bowen: 'Bowen University',
  abuad: 'Afe Babalola University, Ado-Ekiti',
  landmark: 'Landmark University',
  run: "Redeemer's University",
  redeemers: "Redeemer's University",
  pau: 'Pan-Atlantic University',
  aun: 'American University of Nigeria',
  // Polytechnics / colleges (frequently abbreviated)
  yabatech: 'Yaba College of Technology',
  auchipoly: 'Auchi Polytechnic',
  kadpoly: 'Kaduna Polytechnic',
};

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

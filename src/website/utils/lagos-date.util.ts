const TZ = 'Africa/Lagos';

/** Lagos calendar date as YYYY-MM-DD, `days` from today. */
export function lagosDate(days = 0, now = new Date()): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Midnight in Lagos (UTC+1, no DST) on a YYYY-MM-DD date. */
export function lagosMidnight(date: string): Date {
  return new Date(`${date}T00:00:00+01:00`);
}

/** "Sunday, 29 November 2026" for emails. */
export function formatLagosDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(lagosMidnight(date));
}

/** Escape text before putting it into an HTML email. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

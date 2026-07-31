/*
 * Send an onboarding reminder template to EVERYONE registered for CMIT Cohort 1.
 *   npx ts-node scripts/send-onboarding-blast.ts events.onboarding-reminder-1              # dry run (count only)
 *   npx ts-node scripts/send-onboarding-blast.ts events.onboarding-reminder-1 --commit     # send (throttled)
 *
 * Sends from info@cmithub.org with reply-to cmithub@gmail.com (html + plain text).
 * Every send is logged so a re-run RESUMES (skips anyone already sent for this slug).
 *
 * Deliverability guards (added after the 2026-07 Gmail 4.7.28 rate-limit incident):
 *   --gmail-rate <N>   emails/hour to Gmail recipients   (default 300 — safe for a cold/low-rep domain)
 *   --rate <N>         emails/hour to all OTHER providers (default 1000)
 *   --max <N>          cap sends THIS run, then stop (spread a large list over days; resumes next run)
 * Plus exponential backoff with jitter on transient/rate errors.
 *
 * IMPORTANT: Gmail's rate limit is enforced on the SENDING DOMAIN as seen by Gmail
 * recipients, and its rejections are ASYNCHRONOUS (this API returns success, the bounce
 * arrives later). So the *proactive* --gmail-rate throttle is the real protection; ramp
 * it up (double it) each day only once ZeptoMail's bounce report shows deferrals stopped.
 */
import 'dotenv/config';
import * as fs from 'fs';
import { MongoClient } from 'mongodb';
import { SendMailClient } from 'zeptomail';
import { eventsDefaults } from '../src/bulk-email/default-templates/events.defaults';

const SLUG = process.argv[2];
const COMMIT = process.argv.includes('--commit');
const FROM = { address: 'info@cmithub.org', name: 'CMIT' };
const REPLY_TO = 'cmithub@gmail.com';
const EVENT_SLUG = 'cmit-cohort-1';
const GMAIL_RE = /@(gmail|googlemail)\.com$/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function argNum(flag: string, def: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

if (!SLUG) {
  console.error('Usage: send-onboarding-blast.ts <template-slug> [--commit] [--gmail-rate N] [--rate N] [--max N]');
  process.exit(1);
}

function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|h1|tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&rarr;/g, '')
    .replace(/&bull;/g, '-').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n').trim();
}

type SendOutcome = { ok: boolean; permanent?: boolean; stop?: boolean; detail?: string };

/** Send one email, retrying transient/rate errors with exponential backoff + jitter. */
async function sendWithRetry(mail: any, payload: any, to: string): Promise<SendOutcome> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mail.sendMail(payload);
      return { ok: true };
    } catch (e: any) {
      const detail = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || JSON.stringify(e);
      // Credit exhausted → stop the whole run (resumes on re-run once topped up).
      if (/credit/i.test(detail)) return { ok: false, stop: true, detail };
      // Permanent → skip this recipient, don't retry.
      if (/not verified|SM_111|invalid|mailbox.*(not|does not) exist|address.*reject/i.test(detail))
        return { ok: false, permanent: true, detail };
      if (attempt === maxAttempts) return { ok: false, detail };
      // Rate/throttle signals get a much longer backoff than ordinary transient errors.
      const isRate = /rate|too many|429|throttl|temporar|4\.7\.\d+|try again|defer/i.test(detail);
      const base = isRate ? 30_000 : 2_000;
      const wait = base * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000);
      console.log(`  ↻ ${to}: ${detail} — retry ${attempt}/${maxAttempts - 1} in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
  return { ok: false };
}

async function main() {
  const tpl = eventsDefaults.find((t) => t.slug === SLUG);
  if (!tpl) { console.error(`Template not found: ${SLUG}`); process.exit(1); }

  const gmailPerHour = argNum('--gmail-rate', 300);
  const otherPerHour = argNum('--rate', 1000);
  const maxThisRun = argNum('--max', Number.POSITIVE_INFINITY);
  const gmailDelay = Math.ceil(3_600_000 / gmailPerHour);
  const otherDelay = Math.ceil(3_600_000 / otherPerHour);

  const uri = process.env.MONGODB_URI!;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.DATABASE_NAME || 'church_management_system');
  const ev = await db.collection('events').findOne({ registrationSlug: EVENT_SLUG });
  if (!ev) { console.error('CMIT event not found'); process.exit(1); }

  const regs = await db.collection('eventregistrations')
    .find({ event: ev._id, 'attendeeInfo.email': { $ne: null } }, { projection: { 'attendeeInfo.email': 1 } })
    .toArray();
  const emails = [...new Set(regs.map((r) => (r.attendeeInfo?.email || '').trim().toLowerCase()).filter(Boolean))];
  await client.close();

  const gmailCount = emails.filter((e) => GMAIL_RE.test(e)).length;
  const estHours = (gmailCount / gmailPerHour) + ((emails.length - gmailCount) / otherPerHour);
  console.log(`Template: ${SLUG}\nSubject:  ${tpl.subject}\nRecipients (unique): ${emails.length}  (gmail: ${gmailCount})`);
  console.log(`Throttle: gmail ${gmailPerHour}/hr, other ${otherPerHour}/hr` +
    (Number.isFinite(maxThisRun) ? `, max ${maxThisRun} this run` : '') +
    ` — est. ~${estHours.toFixed(1)}h if run to completion`);

  if (!COMMIT) { console.log('\nDRY RUN — re-run with --commit to send.'); return; }

  // Resume log: skip anyone already sent for this slug.
  const logFile = `${__dirname}/.blast-${SLUG}.log`;
  const done = new Set(
    fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [],
  );

  const apiKey = process.env.ZEPTOMAIL_API_KEY!;
  const token = /^Zoho-enczapikey/i.test(apiKey) ? apiKey : `Zoho-enczapikey ${apiKey}`;
  const mail: any = new SendMailClient({ url: 'https://api.zeptomail.com/v1.1/email', token });
  const textbody = htmlToText(tpl.htmlContent);

  let sent = 0, failed = 0, skipped = 0, gmailSent = 0;
  for (const to of emails) {
    if (done.has(to)) { skipped++; continue; }
    if (sent >= maxThisRun) {
      console.log(`\nReached --max ${maxThisRun} for this run — stopping. Re-run later to continue (resumes).`);
      break;
    }
    const isGmail = GMAIL_RE.test(to);
    const res = await sendWithRetry(
      mail,
      { from: FROM, to: [{ email_address: { address: to } }], reply_to: [{ address: REPLY_TO }], subject: tpl.subject, htmlbody: tpl.htmlContent, textbody },
      to,
    );
    if (res.ok) {
      fs.appendFileSync(logFile, to + '\n');
      sent++; if (isGmail) gmailSent++;
      if (sent % 50 === 0) console.log(`  …${sent} sent (${gmailSent} gmail)`);
    } else if (res.stop) {
      console.log(`\n⚠️  ${res.detail} — stopping. Fix and re-run (it resumes).`);
      break;
    } else {
      failed++;
      console.log(`  ✗ ${to}${res.permanent ? ' (permanent)' : ''}: ${res.detail}`);
    }
    // Proactive throttle — the real defence against Gmail's async rate limit.
    await sleep(isGmail ? gmailDelay : otherDelay);
  }
  console.log(`\nDONE — sent ${sent} (gmail ${gmailSent}), failed ${failed}, skipped(already) ${skipped}.`);
}

main().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });

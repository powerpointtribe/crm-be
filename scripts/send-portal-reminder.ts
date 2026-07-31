/*
 * Portal login + Saturday class reminder to every ACCEPTED CMIT registrant.
 * Each email carries a per-recipient set-password/login link ({{setupUrl}}).
 *
 *   npx ts-node scripts/send-portal-reminder.ts                 # dry run (count only)
 *   npx ts-node scripts/send-portal-reminder.ts --sample        # send ONE to gthankgod@gmail.com
 *   npx ts-node scripts/send-portal-reminder.ts --commit        # send to ALL (throttled)
 *
 * Deliverability guards (cmithub.org is a low-reputation domain — see the
 * 2026-07 Gmail 4.7.28 incident): Gmail recipients are throttled hard and
 * transient errors back off. Logs each send so a re-run RESUMES.
 *   --gmail-rate N (default 300/hr)   --rate N (default 1000/hr)   --max N
 */
import 'dotenv/config';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { MongoClient } from 'mongodb';
import { SendMailClient } from 'zeptomail';
import { eventsDefaults } from '../src/bulk-email/default-templates/events.defaults';

const SLUG = 'events.cmit-portal-reminder';
const SAMPLE = process.argv.includes('--sample');
const COMMIT = process.argv.includes('--commit');
const SAMPLE_TO = 'gthankgod@gmail.com';
const FROM = { address: 'info@cmithub.org', name: 'CMIT — Campus Ministers in Training' };
const REPLY_TO = 'cmithub@gmail.com';
const EVENT_SLUG = 'cmit-cohort-1';
const GMAIL_RE = /@(gmail|googlemail)\.com$/i;
const SETUP_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const substitute = (html: string, vars: Record<string, string>) =>
  html.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
function argNum(flag: string, def: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : def;
}
function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, '$2 ($1)')
    .replace(/<\/(p|h1|tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&rarr;/g, '→')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#128172;/g, '')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n').trim();
}

type Outcome = { ok: boolean; permanent?: boolean; stop?: boolean; detail?: string };
async function sendWithRetry(mail: any, payload: any, to: string): Promise<Outcome> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await mail.sendMail(payload);
      return { ok: true };
    } catch (e: any) {
      const detail = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || JSON.stringify(e);
      if (/credit/i.test(detail)) return { ok: false, stop: true, detail };
      if (/not verified|SM_111|invalid|mailbox.*(not|does not) exist|address.*reject/i.test(detail))
        return { ok: false, permanent: true, detail };
      if (attempt === 5) return { ok: false, detail };
      const isRate = /rate|too many|429|throttl|temporar|4\.7\.\d+|try again|defer/i.test(detail);
      await sleep((isRate ? 30_000 : 2_000) * 2 ** (attempt - 1) + Math.floor(Math.random() * 1000));
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

  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(process.env.DATABASE_NAME || 'church_management_system');
  const ev = await db.collection('events').findOne({ registrationSlug: EVENT_SLUG });
  if (!ev) { console.error('CMIT event not found'); process.exit(1); }
  const base = ev.registrationSettings?.applicationBaseUrl || process.env.FRONTEND_URL || 'https://cmithub.org';

  // Recipients: {email, firstName}.
  let recipients: Array<{ email: string; firstName: string }>;
  if (SAMPLE) {
    const reg = await db.collection('eventregistrations').findOne({ event: ev._id, 'attendeeInfo.email': SAMPLE_TO });
    recipients = [{ email: SAMPLE_TO, firstName: reg?.attendeeInfo?.firstName || 'ThankGod' }];
  } else {
    const regs = await db.collection('eventregistrations')
      .find({ event: ev._id, admissionStatus: 'accepted', 'attendeeInfo.email': { $ne: null } })
      .project({ 'attendeeInfo.email': 1, 'attendeeInfo.firstName': 1 })
      .toArray();
    const seen = new Set<string>();
    recipients = [];
    for (const r of regs) {
      const email = (r.attendeeInfo?.email || '').trim().toLowerCase();
      if (email && !seen.has(email)) { seen.add(email); recipients.push({ email, firstName: r.attendeeInfo?.firstName || 'there' }); }
    }
  }

  const gmailCount = recipients.filter((r) => GMAIL_RE.test(r.email)).length;
  console.log(`Template: ${SLUG}\nSubject:  ${tpl.subject}`);
  console.log(`Mode:     ${SAMPLE ? 'SAMPLE (gthankgod only)' : COMMIT ? 'COMMIT (all accepted)' : 'DRY RUN'}`);
  console.log(`Recipients: ${recipients.length}  (gmail: ${gmailCount})`);
  if (!SAMPLE) console.log(`Throttle:   gmail ${gmailPerHour}/hr, other ${otherPerHour}/hr — est. ~${(gmailCount / gmailPerHour + (recipients.length - gmailCount) / otherPerHour).toFixed(1)}h`);

  if (!SAMPLE && !COMMIT) { console.log('\nDRY RUN — re-run with --sample (to you) or --commit (to all).'); await client.close(); return; }

  const apiKey = process.env.ZEPTOMAIL_API_KEY!;
  const token = /^Zoho-enczapikey/i.test(apiKey) ? apiKey : `Zoho-enczapikey ${apiKey}`;
  const mail: any = new SendMailClient({ url: 'https://api.zeptomail.com/v1.1/email', token });

  const logFile = `${__dirname}/.portal-reminder.log`;
  const done = new Set(!SAMPLE && fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : []);

  let sent = 0, failed = 0, skipped = 0, gmailSent = 0;
  for (const rcpt of recipients) {
    if (!SAMPLE && done.has(rcpt.email)) { skipped++; continue; }
    if (sent >= maxThisRun) { console.log(`\nReached --max ${maxThisRun}. Re-run to continue (resumes).`); break; }

    // Mint a fresh set-password token for this recipient.
    const setupToken = randomBytes(24).toString('hex');
    await db.collection('portalaccounts').updateOne(
      { email: rcpt.email },
      { $set: { setupToken, setupTokenExpiresAt: new Date(Date.now() + SETUP_TTL_MS) },
        $setOnInsert: { email: rcpt.email, firstName: rcpt.firstName, status: 'invited' } },
      { upsert: true },
    );
    const setupUrl = `${base.replace(/\/+$/, '')}/portal/set-password?token=${setupToken}`;
    const html = substitute(tpl.htmlContent, { firstName: rcpt.firstName, setupUrl });
    const textbody = htmlToText(html);

    const isGmail = GMAIL_RE.test(rcpt.email);
    const res = await sendWithRetry(mail, {
      from: FROM, to: [{ email_address: { address: rcpt.email } }], reply_to: [{ address: REPLY_TO }],
      subject: tpl.subject, htmlbody: html, textbody,
    }, rcpt.email);

    if (res.ok) {
      if (!SAMPLE) fs.appendFileSync(logFile, rcpt.email + '\n');
      sent++; if (isGmail) gmailSent++;
      if (SAMPLE) console.log(`\n✓ Sample sent to ${rcpt.email}\n  Login link: ${setupUrl}`);
      else if (sent % 50 === 0) console.log(`  …${sent} sent (${gmailSent} gmail)`);
    } else if (res.stop) { console.log(`\n⚠️  ${res.detail} — stopping (resumes on re-run).`); break; }
    else { failed++; console.log(`  ✗ ${rcpt.email}${res.permanent ? ' (permanent)' : ''}: ${res.detail}`); }

    if (!SAMPLE) await sleep(isGmail ? gmailDelay : otherDelay);
  }
  if (!SAMPLE) console.log(`\nDONE — sent ${sent} (gmail ${gmailSent}), failed ${failed}, skipped(already) ${skipped}.`);
  await client.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });

/*
 * Send test samples of the 4 onboarding reminder templates to the reviewers.
 *   npx ts-node scripts/send-onboarding-tests.ts
 *
 * Sends from the CMIT sender (info@cmithub.org) with reply-to cmithub@gmail.com,
 * exactly as the live emails will go out.
 */
import 'dotenv/config';
import { SendMailClient } from 'zeptomail';
import { eventsDefaults } from '../src/bulk-email/default-templates/events.defaults';

const RECIPIENTS = ['gthankgod@gmail.com', 'abigail.tolusanya@gmail.com'];
const FROM = { address: 'info@cmithub.org', name: 'CMIT' };
const REPLY_TO = 'cmithub@gmail.com';
const SLUGS = [
  'events.onboarding-reminder-1',
  'events.onboarding-reminder-2',
  'events.onboarding-reminder-3',
  'events.onboarding-reminder-4',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Plain-text alternative from the HTML — a multipart email reads as far less
// promotional than HTML-only, which helps primary-inbox placement.
function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|h1|tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&rarr;/g, '')
    .replace(/&bull;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

async function main() {
  const apiKey = process.env.ZEPTOMAIL_API_KEY;
  if (!apiKey) throw new Error('ZEPTOMAIL_API_KEY not set');
  const token = /^Zoho-enczapikey/i.test(apiKey)
    ? apiKey
    : `Zoho-enczapikey ${apiKey}`;
  const client: any = new SendMailClient({
    url: 'https://api.zeptomail.com/v1.1/email',
    token,
  });

  for (const slug of SLUGS) {
    const tpl = eventsDefaults.find((t) => t.slug === slug);
    if (!tpl) {
      console.log(`  ✗ template not found: ${slug}`);
      continue;
    }
    for (const to of RECIPIENTS) {
      try {
        await client.sendMail({
          from: FROM,
          to: [{ email_address: { address: to } }],
          reply_to: [{ address: REPLY_TO }],
          subject: tpl.subject,
          htmlbody: tpl.htmlContent,
          textbody: htmlToText(tpl.htmlContent),
        });
        console.log(`  ✓ ${slug} → ${to}`);
      } catch (e: any) {
        const detail =
          e?.error?.details?.[0]?.message ||
          e?.error?.message ||
          e?.message ||
          JSON.stringify(e);
        console.log(`  ✗ ${slug} → ${to}: ${detail}`);
      }
      await sleep(400);
    }
  }
  console.log('\nDone. Check both inboxes for 4 test emails each.');
}

main().catch((e) => {
  console.error('ERR', e?.message || e);
  process.exit(1);
});

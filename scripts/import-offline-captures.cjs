/*
 * IMPORT OFFLINE CAPTURES — fold the Google Sheet (captured during the outage)
 * into prod. One row per person; upsert-by-email so it's safe to re-run.
 *
 *   node scripts/import-offline-captures.cjs ./captures.csv            # dry run
 *   node scripts/import-offline-captures.cjs ./captures.csv --commit   # write
 *
 * Export the Sheet first: File → Download → Comma-separated values (.csv).
 *
 * Per row:
 *   • Deduped by email — never creates a second registration for an existing
 *     email (and updates an application-incomplete → completed if it re-runs).
 *   • Generates a non-colliding CMIT check-in code + application token.
 *   • Status "Application completed"          → sets applicationSubmittedAt, so
 *     the auto-admission cron admits + emails the letter like everyone else.
 *   • Status "Registered — application not completed" → registration only
 *     (they still need to finish the application via their link).
 */
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const SLUG = 'cmit-cohort-1';
const csvPath = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!csvPath) { console.error('Usage: node import-offline-captures.cjs <csv> [--commit]'); process.exit(1); }

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => (v || '').trim() !== ''));
}

const env = {};
for (const l of fs.readFileSync(__dirname + '/../.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !l.trim().startsWith('#')) env[m[1]] = m[2];
}

// Sheet header → value, resilient to column order.
const COMPLETED = 'Application completed';

(async () => {
  const grid = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const headers = (grid.shift() || []).map((h) => h.trim());
  const col = (name) => headers.indexOf(name);
  const get = (r, name) => { const i = col(name); return i === -1 ? '' : (r[i] || '').trim(); };
  if (col('Email') === -1) { console.error('No "Email" column. Headers:', headers); process.exit(1); }

  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(env.DATABASE_NAME || 'church_management_system');
  const Events = db.collection('events');
  const Regs = db.collection('eventregistrations');
  const ev = await Events.findOne({ registrationSlug: SLUG });
  if (!ev) { console.error('CMIT event not found — is MONGODB_URI prod?'); process.exit(1); }
  const prefix = ev.checkInCodePrefix || 'CMIT';

  // Seed the check-in code counter numerically (mirrors the app).
  const codeDocs = await Regs.find(
    { event: ev._id, checkInCode: new RegExp('^' + prefix + '-\\d+$') },
    { projection: { checkInCode: 1 } },
  ).toArray();
  let maxCode = 0;
  for (const d of codeDocs) { const m = String(d.checkInCode).match(/(\d+)$/); if (m) maxCode = Math.max(maxCode, +m[1]); }

  let created = 0, upgraded = 0, skipped = 0;
  for (const r of grid) {
    const email = get(r, 'Email').toLowerCase();
    if (!email) { skipped++; continue; }

    const status = get(r, 'Status');
    const isCompleted = status === COMPLETED;

    // Names: prefer explicit columns; else split Full name.
    let firstName = get(r, 'First name');
    let lastName = get(r, 'Last name');
    if (!firstName && get(r, 'Full name')) {
      const parts = get(r, 'Full name').split(/\s+/);
      firstName = parts.shift() || '';
      lastName = parts.join(' ');
    }
    const phone = get(r, 'Phone');
    const gender = get(r, 'Gender').toLowerCase();

    const cfr = {};
    const put = (k, v) => { if (v) cfr[k] = v; };
    put('university', get(r, 'School / University'));
    put('howDidYouHear', get(r, 'How did you hear'));
    if (isCompleted) {
      put('fullName', get(r, 'Full name'));
      put('courseOfStudy', get(r, 'Course of study'));
      put('currentLevel', get(r, 'Current level'));
      put('stateRegion', get(r, 'State / Region'));
      put('fellowshipName', get(r, 'Fellowship'));
      put('academicStanding', get(r, 'Academic standing'));
      put('academicProbation', get(r, 'On academic probation'));
      put('probationExplanation', get(r, 'Probation explanation'));
      put('ministryInvolvement', get(r, 'Ministry involvement'));
      put('serviceDuration', get(r, 'Service duration'));
      put('campusConcern', get(r, 'Campus concern'));
    }

    const existing = await Regs.findOne({ event: ev._id, 'attendeeInfo.email': email });
    if (existing) {
      // Already in prod. If our row is completed but theirs isn't, upgrade it.
      if (isCompleted && !existing.applicationSubmittedAt) {
        if (COMMIT) {
          await Regs.updateOne({ _id: existing._id }, {
            $set: {
              applicationSubmittedAt: new Date(),
              ...(gender ? { 'attendeeInfo.gender': gender } : {}),
              customFieldResponses: { ...(existing.customFieldResponses || {}), ...cfr },
              updatedAt: new Date(),
            },
          });
        }
        upgraded++;
        console.log(`${COMMIT ? 'upgraded' : 'would upgrade'}: ${email} → application completed`);
      } else {
        skipped++;
      }
      continue;
    }

    maxCode += 1;
    const doc = {
      event: ev._id,
      branch: ev.branch,
      attendeeType: 'visitor',
      attendeeInfo: { firstName, lastName, email, phone, ...(gender ? { gender } : {}) },
      status: 'pending',
      admissionStatus: 'applied',
      customFieldResponses: cfr,
      checkInCode: `${prefix}-${String(maxCode).padStart(3, '0')}`,
      applicationToken: crypto.randomBytes(24).toString('hex'),
      ...(isCompleted ? { applicationSubmittedAt: new Date() } : {}),
      registeredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (COMMIT) await Regs.insertOne(doc);
    created++;
    console.log(`${COMMIT ? 'created' : 'would create'}: ${email} → ${doc.checkInCode}${isCompleted ? ' (completed)' : ' (reg only)'}`);
  }

  console.log(`\n${COMMIT ? 'DONE' : 'DRY RUN'} — created ${created}, upgraded ${upgraded}, skipped ${skipped}.`);
  if (!COMMIT) console.log('Re-run with --commit to write.');
  else console.log('Completed applications will be admitted + emailed by the 15-min auto-admission cron.');
  await client.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });

/**
 * One-time seed script: Social Media & Digital Influence Academy
 * Creates event, 4 sessions, and imports 32 participants from CSV data.
 *
 * Run: npx ts-node src/events/seeders/seed-social-media-academy.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DATABASE_NAME || 'church_management_system';

// Anthony branch ID (from prod DB)
const ANTHONY_BRANCH_ID = '69b1767e20f537d6257924f9';

// CSV data (32 participants)
const PARTICIPANTS = [
  { name: 'Oluwafayokemi Kolawole', email: 'fayokola@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Filming & Editing skills.' },
  { name: 'Eniola Alemu', email: 'eniolaalemu@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Knowing what Social media entails' },
  { name: 'Tobi Eniafe', email: 'eniafeoluwatobi93@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Effective way to posting, understanding the metrics' },
  { name: 'Mawuna', email: 'adesanyamawuna3rd@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'New/improved skills, consistency through accountability, growth' },
  { name: 'Garuba Ayodele', email: 'garubaayodele0611@gmail.com', platform: '', availability: 'Yes', goals: '' },
  { name: 'Aduwo Emmanuel Opeyemi', email: 'eopeyemi49@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Insight on how to navigate the social media space for influence' },
  { name: 'Lote Bukunmi', email: 'iwunohelizabeth@gmail.com', platform: 'Youtube', availability: 'Yes', goals: 'Posting consistently' },
  { name: 'Eniola Olanisebe', email: 'olanisebeni@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Confidence and clarity about what type of content to post' },
  { name: 'Abigail Tolu-Sanya', email: 'abigail.tolusanya@gmail.com', platform: 'Instagram', availability: 'Yes', goals: '' },
  { name: 'Peace Joseph', email: 'peacejoseph.poj@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Learn to create meaningful content and build a community' },
  { name: 'Tobi Coker', email: 'cokertobi1@gmail.com', platform: 'Youtube', availability: 'Yes', goals: 'Different analytical skills and how to cater to a niche' },
  { name: 'Pelumi Fatolu', email: 'fatolupelumi@gmail.com', platform: 'X', availability: 'Yes', goals: 'Influence social space' },
  { name: 'Alonge Toluwani', email: 'tolualonge123@gmail.com', platform: 'Youtube', availability: 'Yes', goals: 'How to do digital marketing and make sales online' },
  { name: 'Elizabeth Habebe', email: 'habebeelizabeth@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Build consistency in posting educative contents' },
  { name: 'Folashade Florence', email: 'folatoyowunmi@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Take my social media game from a-z level' },
  { name: 'Folashayo Sule', email: 'suleayomiposi@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Effectively use social media to propagate the gospel' },
  { name: 'Blessing Ogunleye', email: 'blessingogunleye2@gmail.com', platform: 'LinkedIn', availability: 'Maybe', goals: 'Be more consistent with posting' },
  { name: 'Christiana Adeboye', email: 'christianaadeboye2@gmail.com', platform: 'X', availability: 'Yes', goals: '' },
  { name: 'Okesanya Olamide', email: 'okesanyaolamide24@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'How to organically increase my following' },
  { name: 'Aleshinloye Precious', email: 'preciousalesinloye@gmail.com', platform: 'Tiktok', availability: 'Yes', goals: '' },
  { name: 'Mirabel Adeen', email: 'themirabelayavoro@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Effectively use social media to advocate the cause of Jesus' },
  { name: 'Allison Onyinyechukwu', email: 'allisononyii@gmail.com', platform: 'Instagram', availability: 'Maybe', goals: 'Gain confidence in practising all taught' },
  { name: 'Ogundipe Eniola', email: 'ogundipee4@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Finding my root on the social media space' },
  { name: 'Oluwakolade Adelaja', email: 'tomiwablue@gmail.com', platform: 'Youtube', availability: 'Yes', goals: 'A zeal to consistently grow and reflect whom God called me to become' },
  { name: 'Elizabeth Oyelami', email: 'surulereife@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Sound knowledge of digital marketing and technology' },
  { name: 'Motunrayo Toriola Elizabeth', email: 'motunrayotoriola01@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Insights on how to digitally influence the social space' },
  { name: 'Onwuzurike Odinakachukwu Faith', email: 'onwuzurikefaith05@gmail.com', platform: 'WhatsApp', availability: 'Yes', goals: 'As much knowledge as possible' },
  { name: 'Ahamefula Uche Great', email: 'uchegreat30@gmail.com', platform: 'Youtube', availability: 'Yes', goals: '' },
  { name: 'Edidiong Umoh', email: 'edidiongumoh421@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Understand social media algorithms and reaching more people' },
  { name: 'Bolarinde Tomiwa Ayobami', email: 'tomiwabolarinde@gmail.com', platform: 'Instagram', availability: 'Maybe', goals: 'Give my business visibility it requires' },
  { name: 'Olorunju Olayemi', email: 'olayemi.olorunju@gmail.com', platform: 'Instagram', availability: 'Yes', goals: 'Better mastery of how social media works and consistency' },
  { name: 'Mbang Ejukwa Rita', email: 'ritawealth01@gmail.com', platform: 'Youtube', availability: 'Yes', goals: 'How to effectively push online programs for targeted audience' },
];

const SESSIONS = [
  {
    title: 'Week 1: Clear & Effective Communication',
    date: new Date('2026-05-24T19:00:00'),
    startTime: '19:00',
    endTime: '20:30',
    facilitator: 'Pst. Dami Oguntunde',
    order: 1,
  },
  {
    title: 'Week 2: Quality of Work & Content Excellence',
    date: new Date('2026-05-31T19:00:00'),
    startTime: '19:00',
    endTime: '20:30',
    facilitator: 'Akinboboye Israel',
    order: 2,
  },
  {
    title: 'Week 3: Spread Effect & Community Building',
    date: new Date('2026-06-07T19:00:00'),
    startTime: '19:00',
    endTime: '20:30',
    facilitator: 'Ibironke (External Trainer)',
    order: 3,
  },
  {
    title: 'Week 4: Accountability & Evaluation',
    date: new Date('2026-06-14T19:00:00'),
    startTime: '19:00',
    endTime: '20:30',
    facilitator: 'LDI Team (Internal)',
    order: 4,
  },
];

function generateCheckInCode(index: number): string {
  return `SMA-${String(index + 1).padStart(3, '0')}`;
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

async function seed() {
  console.log('🚀 Starting Social Media Academy seed...');
  console.log(`   DB: ${MONGODB_URI.split('@')[1]?.split('/')[0] || 'local'}`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const branchId = new ObjectId(ANTHONY_BRANCH_ID);
  const now = new Date();

  // 1. Create Event
  console.log('\n📅 Creating event...');
  const eventDoc = {
    title: 'Social Media & Digital Influence Academy',
    slug: 'social-media-academy-2026',
    description: 'A 4-week training program by the LDI Team to equip Tribesmen with social media and digital influence skills. Platforms: Instagram, TikTok, Twitter (X), YouTube.',
    type: 'training',
    status: 'published',
    startDate: new Date('2026-05-24T19:00:00'),
    endDate: new Date('2026-06-14T20:30:00'),
    startTime: '19:00',
    endTime: '20:30',
    location: {
      name: 'Virtual (Online)',
      isVirtual: true,
    },
    branch: branchId,
    bannerImage: '',
    contactEmail: 'info@powerpointtribe.org',
    tags: ['training', 'social-media', 'digital-influence', 'ldi'],
    registrationSettings: {
      isOpen: false,
      maxAttendees: 30,
      requireApproval: false,
      allowWaitlist: false,
      customFields: [
        { id: 'platform', label: 'Primary Platform', type: 'text', required: false, options: [], order: 1 },
        { id: 'availability', label: 'Available for all sessions?', type: 'text', required: false, options: [], order: 2 },
        { id: 'goals', label: 'What do you hope to gain?', type: 'textarea', required: false, options: [], order: 3 },
      ],
      formStatus: 'closed',
    },
    trainingConfig: {
      hasMultipleSessions: true,
      totalSessions: 4,
      requireAllSessions: true,
      minimumAttendancePercentage: 85,
      hasCertification: true,
      passingScore: 70,
      allowRetakes: false,
    },
    sessionCount: 4,
    completedSessionCount: 0,
    registrationCount: PARTICIPANTS.length,
    confirmedCount: PARTICIPANTS.length,
    attendedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const eventResult = await db.collection('events').insertOne(eventDoc);
  const eventId = eventResult.insertedId;
  console.log(`   ✅ Event created: ${eventId}`);

  // 2. Create Sessions
  console.log('\n📋 Creating sessions...');
  const sessionIds: ObjectId[] = [];
  for (const s of SESSIONS) {
    const sessionDoc = {
      event: eventId,
      branch: branchId,
      title: s.title,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      sessionType: 'workshop',
      order: s.order,
      status: 'scheduled',
      facilitators: [{ name: s.facilitator, role: 'lead' }],
      attendanceConfig: {
        isRequired: true,
        allowLateArrival: true,
        lateArrivalThresholdMinutes: 15,
      },
      attendanceCount: 0,
      lateCount: 0,
      absentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('eventsessions').insertOne(sessionDoc);
    sessionIds.push(result.insertedId);
    console.log(`   ✅ Session ${s.order}: ${s.title} (${result.insertedId})`);
  }

  // 3. Import Participants as Registrations
  console.log(`\n👥 Importing ${PARTICIPANTS.length} participants...`);
  let imported = 0;

  for (let i = 0; i < PARTICIPANTS.length; i++) {
    const p = PARTICIPANTS[i];
    const { firstName, lastName } = parseName(p.name);
    const checkInCode = generateCheckInCode(i);

    // Note: do NOT include `member` field — the unique sparse index on (event, member)
    // treats null as a value and would cause duplicates for visitor registrations.
    const regDoc: Record<string, any> = {
      event: eventId,
      branch: branchId,
      attendeeType: 'visitor',
      attendeeInfo: {
        firstName,
        lastName,
        email: p.email.toLowerCase(),
        phone: '',
        gender: '',
      },
      status: 'confirmed',
      checkInCode,
      customFieldResponses: {
        platform: p.platform,
        availability: p.availability,
        goals: p.goals,
      },
      registeredAt: now,
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('eventregistrations').insertOne(regDoc);
    imported++;
  }
  console.log(`   ✅ ${imported} participants imported`);

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Seed completed successfully!');
  console.log(`   Event ID: ${eventId}`);
  console.log(`   Sessions: ${sessionIds.length}`);
  console.log(`   Participants: ${imported}`);
  console.log('═══════════════════════════════════════\n');

  await client.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

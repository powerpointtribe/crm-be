/**
 * LOCAL DEVELOPMENT ONLY: seed website content from the design handover
 * (Option A artboards) so the website renders realistic data.
 *
 *   MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true' \
 *   DATABASE_NAME=crm_be_local npm run seed:website
 *
 * Safety:
 * - Never loads a .env file; MONGODB_URI and DATABASE_NAME must be passed explicitly.
 * - Refuses NODE_ENV=production, any non-localhost host, and database names
 *   without "local" or "test" in them.
 * - Website-only collections (web_*) are replaced. Shared collections
 *   (branches, events, store_products) are only upserted by slug for the seed
 *   records; nothing else in them is touched or deleted.
 * - Never touches donations or orders.
 * `[Bracketed]` text is placeholder copy still to come from the church.
 */
import { connect, disconnect, model, Model, Types } from 'mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  GivingAccount,
  GivingAccountSchema,
} from '../giving/schemas/giving.schemas';
import {
  LostItem,
  LostItemSchema,
} from '../lost-found/schemas/lost-item.schema';
import {
  LostItemClaim,
  LostItemClaimSchema,
} from '../lost-found/schemas/lost-item-claim.schema';
import { Product, ProductSchema } from '../store/schemas/product.schema';
import {
  WebDevotional,
  WebDevotionalSchema,
  WebFaq,
  WebFaqSchema,
  WebPastor,
  WebPastorSchema,
  WebSnippet,
  WebSnippetSchema,
  WebTestimony,
  WebTestimonySchema,
} from '../website/schemas/web-content.schema';
import {
  WebSeries,
  WebSeriesSchema,
} from '../website/schemas/web-series.schema';
import {
  WebSermon,
  WebSermonSchema,
} from '../website/schemas/web-sermon.schema';
import {
  WebsiteSettings,
  WebsiteSettingsSchema,
} from '../website/schemas/website-settings.schema';
import { slugify } from '../website/utils/text.util';

function assertLocal(uri: string | undefined, dbName: string | undefined) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to seed: NODE_ENV=production');
  if (!uri || !dbName)
    throw new Error(
      'Set MONGODB_URI and DATABASE_NAME explicitly (no .env is read).',
    );
  const hosts = uri
    .replace(/^mongodb(\+srv)?:\/\//, '')
    .split('/')[0]
    .split('@')
    .pop()!
    .split(',');
  if (
    uri.startsWith('mongodb+srv') ||
    !hosts.every((h) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h))
  ) {
    throw new Error(
      `Refusing to seed a non-local MongoDB (${hosts.join(',')}).`,
    );
  }
  if (!/(local|test)/i.test(dbName)) {
    throw new Error(
      `Refusing to seed database "${dbName}": name must contain "local" or "test".`,
    );
  }
}

const published = { status: 'published' as const };
/** Lagos is UTC+1 all year (no DST). */
const lagos = (y: number, m: number, d: number, hh = 0, mm = 0) =>
  new Date(Date.UTC(y, m - 1, d, hh - 1, mm));
const maps = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DATABASE_NAME;
  assertLocal(uri, dbName);
  await connect(uri!, { dbName });
  const now = new Date();
  const seeder = new Types.ObjectId(); // createdBy/postedBy for seed rows

  const M = {
    branch: model(Branch.name, BranchSchema),
    event: model(Event.name, EventSchema),
    settings: model(WebsiteSettings.name, WebsiteSettingsSchema),
    series: model(WebSeries.name, WebSeriesSchema),
    sermon: model(WebSermon.name, WebSermonSchema),
    devotional: model(WebDevotional.name, WebDevotionalSchema),
    pastor: model(WebPastor.name, WebPastorSchema),
    testimony: model(WebTestimony.name, WebTestimonySchema),
    snippet: model(WebSnippet.name, WebSnippetSchema),
    faq: model(WebFaq.name, WebFaqSchema),
    giving: model(GivingAccount.name, GivingAccountSchema),
    lost: model(LostItem.name, LostItemSchema),
    claim: model(LostItemClaim.name, LostItemClaimSchema),
    product: model(Product.name, ProductSchema),
  };

  // Website-only collections: replace.
  await Promise.all(
    [
      M.settings,
      M.series,
      M.sermon,
      M.devotional,
      M.pastor,
      M.testimony,
      M.snippet,
      M.faq,
      M.giving,
      M.lost,
      M.claim,
    ].map((m) => (m as Model<unknown>).deleteMany({})),
  );

  await M.settings.create({
    key: 'site',
    serviceStrip: [
      {
        label: 'Sunday Service',
        day: 'Every Sunday',
        time: '9:00am',
        note: 'all campuses',
      },
      {
        label: 'Bible Study',
        day: 'Every Thursday',
        time: '6:30pm',
        note: 'all campuses',
      },
    ],
    platformUrls: {
      youtube: 'https://www.youtube.com/@powerpointtribe',
      instagram: 'https://www.instagram.com/powerpointtribe',
      facebook: 'https://www.facebook.com/powerpointtribe',
      x: 'https://x.com/Powerpointtribe',
    },
    contactEmails: {},
  });

  // Pastors (order from the handover notes; only Pastor Dami's bio is confirmed).
  const pastorRows: [string, string][] = [
    ['Pastor Dami Oguntunde', 'Senior Pastor'],
    ['Pastor Aby Oguntunde', 'Associate Pastor'],
    ['Pastor Nonso Orji', 'Campus Pastor, PPT Ikorodu'],
    ['Pastor Ejiro Orji', 'Associate Pastor, PPT Ikorodu'],
    ['Pastor Oluwajuwon Abolarin', 'Campus Pastor, PPT Abuja'],
    ['Pastor Pipeloluwa Abolarin', 'Associate Pastor, PPT Abuja'],
    ['Pastor Olayinka Adebayo', 'Associate Pastor'],
    ['Pastor Ayomide Arowele', 'Associate Pastor'],
    ['Pastor Damilola Bukunmi', 'Associate Pastor'],
    ['Pastor Mayowa Oladunjoye', 'Associate Pastor'],
    ['Pastor Habib Hammed', 'Associate Pastor'],
  ];
  const pastors = await M.pastor.create(
    pastorRows.map(([name, role], i) => ({
      ...published,
      name,
      role,
      order: i + 1,
      bio:
        i === 0
          ? "Pastor Dami is the Senior Pastor of The PowerPoint Tribe, an expression of The Baptizing Church Global, and pastors our Anthony campus. He is a transformational leader, consultant and author whose teachings, books, podcasts, blog posts and devotionals have impacted many lives.\n\nHe is also the Co-Founder and CEO of Harde Business School, an edtech company empowering the workforce of Africa's digital transformation age. He is married to Aby, and they are blessed with three daughters."
          : undefined,
    })),
  );

  // Campuses: upsert the three website campuses by slug (other branches untouched).
  const serviceTimes = [
    { label: 'Sunday Service', day: 'Sunday', time: '9:00am' },
    { label: 'Bible Study', day: 'Thursday', time: '6:30pm' },
  ];
  const campusRows = [
    {
      slug: 'ppt-anthony',
      name: 'PPT Anthony',
      venue: 'The Garrison',
      street: '300 Ikorodu-Ososun Rd, Anthony',
      city: 'Lagos',
      main: true,
      pastor: 0,
    },
    {
      slug: 'ppt-ikorodu',
      name: 'PPT Ikorodu',
      venue: 'Rehoboth',
      street: '70 Ikorodu Rd, beside First Bank, Haruna Bus Stop, Ikorodu',
      city: 'Lagos',
      main: false,
      pastor: 2,
    },
    {
      slug: 'ppt-abuja',
      name: 'PPT Abuja',
      venue: 'Peniel',
      street: 'Peniel Apartments, 171 Adetokunbo Ademola Crescent, Wuse 2',
      city: 'Abuja',
      main: false,
      pastor: 4,
    },
  ];
  const campus: Record<string, Types.ObjectId> = {};
  for (const [i, c] of campusRows.entries()) {
    const doc = await M.branch.findOneAndUpdate(
      { slug: c.slug },
      {
        $set: {
          name: c.name,
          isActive: true,
          address: { street: c.street, city: c.city, country: 'Nigeria' },
          website: {
            showOnWebsite: true,
            venue: c.venue,
            mapUrl: maps(`${c.street}, ${c.city}`),
            serviceTimes,
            order: i + 1,
            pastor: pastors[c.pastor]._id,
          },
        },
        $setOnInsert: {
          slug: c.slug,
          isMainBranch: c.main,
          timezone: 'Africa/Lagos',
        },
      },
      { upsert: true, new: true },
    );
    campus[c.slug] = doc._id;
  }
  await M.pastor.updateOne(
    { _id: pastors[0]._id },
    { branch: campus['ppt-anthony'] },
  );

  const snippet = (kind: 'unit' | 'tribe_group', rows: [string, string][]) =>
    rows.map(([name, body], i) => ({
      ...published,
      kind,
      name,
      body,
      order: i + 1,
    }));
  await M.snippet.create([
    ...snippet('unit', [
      ['Beckoners', 'Music'],
      ['Waves', 'Sound, in-house and on stream'],
      ['Buzz', 'Media: projection, photography, videography and streaming'],
      ['Optics', 'Design'],
      [
        'TGX',
        'The Grand Xperience: ushering, and the overall experience and ambience',
      ],
      ['GIA', 'Data: attendance, follow-up and first timers'],
      ['J9:4', 'Facility management'],
      [
        'HOBz',
        'House of Bread: admin for Bible Study, workforce training, Push Buttons and more',
      ],
      ["Tribe's Heart", 'Welfare'],
      ['Protocol', 'Care for the pastorate'],
      ['Olives', 'Children'],
      ['R199', 'Outreach and evangelism'],
    ]),
    ...snippet('tribe_group', [
      [
        'Bamboos',
        'The men of the Tribe, growing deep roots together. [One line on what they do.]',
      ],
      [
        'Pillars',
        'The women of the Tribe, strong in faith and steady for each other. [One line.]',
      ],
      [
        'Cleavers',
        'For married members, building homes on the Word together. [One line.]',
      ],
      [
        'Districts',
        'Members grouped by area to fellowship together on a smaller scale. [Add how districts work.]',
      ],
    ]),
  ]);

  const faq = (page: 'give' | 'visit', rows: [string, string][]) =>
    rows.map(([question, body], i) => ({
      ...published,
      page,
      question,
      body,
      order: i + 1,
    }));
  await M.faq.create([
    ...faq('visit', [
      [
        'What time are services at PowerPoint Tribe?',
        'Sunday Service is every Sunday at 9:00am and Bible Study is every Thursday at 6:30pm. Both hold in person at all three campuses and stream live online.',
      ],
      [
        'Who is the Tribe for?',
        "Everyone. PowerPoint Tribe is one of the many expressions of The Baptizing Church Global, and there's a seat for you whatever your age or stage of life.",
      ],
      [
        'What should I wear?',
        "Whatever you're comfortable in. Come as you are.",
      ],
      ['Is there parking?', '[Add parking details for each campus.]'],
      [
        'Can I watch online?',
        'Yes. Sunday Service (9:00am) and Bible Study (Thursdays, 6:30pm) both stream live on YouTube and Mixlr.',
      ],
    ]),
    ...faq('give', [
      [
        'Which account should I use?',
        'Give to the campus you attend. If you join us online or from outside Nigeria, use the foreign currency accounts or pay online.',
      ],
      [
        'Is online giving secure?',
        'Yes. Online payments are processed by Flutterwave, and we never see or store your card details.',
      ],
      [
        'How do I stop or change my partnership?',
        'Message the finance team to update or pause your partnership at any time.',
      ],
      [
        'Who do I contact about a gift?',
        'Message the finance team with your receipt number and they will help.',
      ],
    ]),
  ]);

  await M.testimony.create(
    [
      ['Inyang', 'ppt-anthony'],
      ['Ibukun', 'ppt-ikorodu'],
      ['Ifekristi', 'ppt-abuja'],
    ].map(([name, slug], i) => ({
      ...published,
      approved: true,
      order: i + 1,
      name,
      body: '[Member testimony, max three lines.]',
      branch: campus[slug],
    })),
  );

  // Series + sermons
  const seriesRows = [
    {
      title: 'Think On These Things',
      serviceLabel: 'Global Service',
      speaker: 'Pastor Dami Oguntunde',
      startDate: lagos(2026, 7, 5),
    },
    {
      title: 'Gems from Acts',
      serviceLabel: 'Bible Study',
      speaker: 'Pastor Dami Oguntunde',
      startDate: lagos(2026, 5, 7),
    },
    {
      title: 'Laws of Faith 5.0',
      serviceLabel: 'Global Service',
      speaker: 'Pastor Dami Oguntunde',
      startDate: lagos(2026, 3, 1),
    },
    {
      title: 'Becoming an Example',
      speaker: 'Various speakers',
      startDate: lagos(2026, 1, 11),
    },
  ];
  const series = await M.series.create(
    seriesRows.map((s) => ({
      ...published,
      ...s,
      slug: slugify(s.title),
      description: '[Series description.]',
    })),
  );
  const seriesId = (t: string) => series.find((s) => s.title === t)!._id;
  const sermons: Record<string, unknown>[] = [];
  for (let n = 1; n <= 15; n++) {
    sermons.push({
      title: n === 15 ? 'Think On These Things' : `[Message title] ${n}`,
      date: lagos(2026, 7, 5 + (n - 1) * 7, 9),
      service: 'sunday',
      speaker: 'Pastor Dami Oguntunde',
      partNumber: n,
      branch: campus['ppt-anthony'],
      series: seriesId('Think On These Things'),
      speakerPastor: pastors[0]._id,
    });
  }
  sermons.push(
    {
      title: 'The Law of Clarity',
      date: lagos(2026, 4, 12, 9),
      service: 'sunday',
      speaker: 'Pastor Dami Oguntunde',
      branch: campus['ppt-anthony'],
      series: seriesId('Laws of Faith 5.0'),
      partNumber: 1,
    },
    {
      title: 'I-C-E: Influential Conscientious Examples',
      date: lagos(2026, 4, 9, 18, 30),
      service: 'bible_study',
      speaker: 'Pastor Habib Hammed',
      branch: campus['ppt-ikorodu'],
      series: seriesId('Becoming an Example'),
      partNumber: 2,
    },
  );
  const slugs = Object.keys(campus);
  for (let i = 0; i < 12; i++) {
    sermons.push({
      title: `[Sermon title] ${i + 1}`,
      date: lagos(2026, 3, 29 - i * 2, 9),
      service: (['sunday', 'bible_study', 'special'] as const)[i % 3],
      speaker: [
        'Pastor Dami Oguntunde',
        'Pastor Dami Awosanmi',
        'Pastor Habib Hammed',
      ][i % 3],
      branch: campus[slugs[i % 3]],
      series: i % 4 === 0 ? seriesId('Gems from Acts') : null,
    });
  }
  sermons.push({
    title: '[Draft] Imported from YouTube',
    date: lagos(2026, 11, 8, 9),
    service: 'sunday',
    speaker: 'Pastor Dami Oguntunde',
    status: 'draft',
  });
  await M.sermon.create(
    sermons.map((s, i) => ({
      ...published,
      ...s,
      slug: `${slugify(String(s.title))}-${i + 1}`,
    })),
  );

  await M.devotional.create([
    {
      ...published,
      title: 'The Joy of Being With The Lord',
      date: lagos(2026, 4, 13, 6),
    },
    {
      ...published,
      title: 'By Faith, Choose Resurrection',
      date: lagos(2026, 4, 6, 6),
    },
    { ...published, title: 'Come Boldly', date: lagos(2026, 3, 30, 6) },
  ]);

  // Events: upsert by registrationSlug; past dates roll forward a year.
  const future = (d: Date) => {
    const x = new Date(d);
    while (x < now) x.setUTCFullYear(x.getUTCFullYear() + 1);
    return x;
  };
  const eventRows = [
    {
      title: 'SOZO Conference',
      typeLabel: 'Word conference',
      start: lagos(2026, 11, 14, 10),
      hours: 6,
      campus: 'ppt-anthony',
      description: 'Three days in the Word. This year’s theme: Rooted.',
      featured: true,
    },
    {
      title: 'Cubit',
      typeLabel: 'Quarterly prayer meeting',
      start: lagos(2026, 11, 21, 18),
      hours: 3,
      campus: 'ppt-ikorodu',
      description: 'Three hours of prayer together, once a quarter.',
    },
    {
      title: 'JUBA',
      typeLabel: 'Worship experience',
      start: lagos(2026, 12, 5, 17),
      hours: 4,
      campus: null,
      description: 'An evening of praise and worship with the whole Tribe.',
    },
    {
      title: 'Travail & Triumph',
      typeLabel: 'Prayer meeting',
      start: lagos(2026, 12, 12, 12),
      hours: 7,
      campus: 'ppt-abuja',
      description: 'Seven hours of prayer to close the year.',
    },
  ];
  for (const e of eventRows) {
    const startDate = future(e.start);
    const registrationSlug = `${slugify(e.title)}-${startDate.getUTCFullYear()}`;
    await M.event.findOneAndUpdate(
      { registrationSlug },
      {
        $set: {
          title: e.title,
          description: e.description,
          status: 'published',
          startDate,
          endDate: new Date(startDate.getTime() + e.hours * 3_600_000),
          branch: e.campus ? campus[e.campus] : null,
          isGlobal: !e.campus,
          website: {
            showOnWebsite: true,
            kind: 'one_off',
            typeLabel: e.typeLabel,
            featured: !!e.featured,
          },
        },
        $setOnInsert: { registrationSlug, type: 'other' },
      },
      { upsert: true, new: true },
    );
  }

  // Giving accounts (from the Give artboard). Foreign name/SWIFT still to confirm.
  await M.giving.create([
    {
      branch: campus['ppt-anthony'],
      currency: 'NGN',
      bank: 'Zenith Bank Plc',
      accountNumber: '1221642022',
      accountName: 'The Powerpoint Tribesmen Chris. Min',
      approvalStatus: 'approved',
      order: 1,
    },
    {
      branch: campus['ppt-ikorodu'],
      currency: 'NGN',
      bank: 'Union Bank',
      accountNumber: '0230914600',
      accountName: 'The PowerPoint Tribesman Christian Ministries',
      approvalStatus: 'approved',
      order: 1,
    },
    {
      branch: campus['ppt-abuja'],
      currency: 'NGN',
      bank: 'Stanbic IBTC Bank',
      accountNumber: '0081942755',
      accountName: 'The PowerPoint Tribesman Christian Ministries - Abuja',
      approvalStatus: 'approved',
      order: 1,
    },
    {
      branch: null,
      currency: 'USD',
      bank: 'Zenith Bank Plc',
      accountNumber: '5072274115',
      approvalStatus: 'approved',
      order: 1,
    },
    {
      branch: null,
      currency: 'GBP',
      bank: 'Zenith Bank Plc',
      accountNumber: '5060562617',
      approvalStatus: 'approved',
      order: 2,
    },
    {
      branch: null,
      currency: 'EUR',
      bank: 'Zenith Bank Plc',
      accountNumber: '5080543607',
      approvalStatus: 'approved',
      order: 3,
    },
    {
      branch: campus['ppt-anthony'],
      currency: 'NGN',
      bank: 'Draft Bank',
      accountNumber: '9999999999',
      approvalStatus: 'draft',
      order: 0,
    },
  ]);

  // Products (Shop artboard): upsert by slug; prices in Naira (live store unit).
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const productRows = [
    {
      slug: 'new-book-pastor-dami',
      name: '[Book title]',
      byline: 'Pastor Dami Oguntunde',
      category: 'books',
      price: 7500,
      badge: 'new',
      isFeatured: true,
      description: "[Two lines on what the book is about and who it's for.]",
    },
    {
      slug: 'push-buttons-vol-1',
      name: 'Push Buttons, Vol. 1',
      byline: 'Weekly devotional collection',
      category: 'books',
      price: 5000,
      badge: 'bestseller',
    },
    {
      slug: 'laws-of-faith-study-guide',
      name: 'Laws of Faith Study Guide',
      byline: 'Companion to the series',
      category: 'books',
      price: 3500,
    },
    {
      slug: 'tribe-tee',
      name: 'Tribe Tee',
      byline: 'Black · S to XXL',
      category: 'merch',
      price: 12000,
      variants: sizes.map((size) => ({ size, colour: 'Black', stock: 10 })),
    },
    {
      slug: 'sabbath-season-tee',
      name: 'Sabbath Season Tee',
      byline: 'White · S to XXL',
      category: 'merch',
      price: 12000,
      variants: sizes.map((size) => ({ size, colour: 'White', stock: 0 })),
    },
    {
      slug: 'tribe-cap',
      name: 'Tribe Cap',
      byline: 'One size',
      category: 'merch',
      price: 8000,
    },
    {
      slug: 'sermon-notes-journal',
      name: 'Sermon Notes Journal',
      byline: '120 pages, lined',
      category: 'accessories',
      price: 4500,
    },
  ];
  for (const p of productRows) {
    await M.product.findOneAndUpdate(
      { slug: p.slug },
      {
        $set: {
          variants: [],
          badge: null,
          isFeatured: false,
          ...p,
          isActive: true,
          currency: 'NGN',
          images: [],
        },
        $setOnInsert: { createdBy: seeder },
      },
      { upsert: true, new: true },
    );
  }

  // Lost and found (CareCloset artboard), dated relative to now.
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const lost: [string, string, string, number, string?][] = [
    ['Black umbrella', 'other', 'ppt-anthony', 2],
    ['Navy denim jacket', 'clothing', 'ppt-ikorodu', 2],
    ['Pink water bottle', 'bottles', 'ppt-anthony', 5],
    ['Car key with blue tag', 'keys', 'ppt-abuja', 9],
    ['Wireless earbuds case', 'gadgets', 'ppt-ikorodu', 9],
    ["Child's yellow cardigan", 'clothing', 'ppt-abuja', 16],
    ['Bible with leather cover', 'other', 'ppt-anthony', 16],
    ['Brown tote bag', 'bags', 'ppt-anthony', 9, 'collected'],
    [
      'Grey hoodie (awaiting desk review)',
      'clothing',
      'ppt-anthony',
      0,
      'pending_review',
    ],
  ];
  await M.lost.create(
    lost.map(([description, type, slug, ago, status]) => ({
      description,
      type,
      branch: campus[slug],
      foundOn: daysAgo(ago),
      listedUntil: new Date(daysAgo(ago).getTime() + 30 * 86_400_000),
      status: status ?? 'listed',
      postedBy: seeder,
    })),
  );

  console.log('Website seed complete:', {
    campuses: Object.keys(campus),
    sermons: sermons.length,
    series: series.length,
    events: eventRows.length,
    products: productRows.length,
    lostItems: lost.length,
  });
  await disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnect().catch(() => undefined);
  process.exit(1);
});

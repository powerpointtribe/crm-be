import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { WEBSITE_CONTENT_CONTROLLERS } from './controllers/website-content.controller';
import { WebsitePublicController } from './controllers/website-public.controller';
import { WebsiteSettingsController } from './controllers/website-settings.controller';
import { WebsitePermission as P } from './permissions';
import { WebContentService } from './services/web-content.service';
import { WebsiteAccessService } from './services/website-access.service';
import { WebsiteSettingsService } from './services/website-settings.service';
import { WebSermonsService } from './services/sermons.service';
import { WEBSITE_MODELS } from './website.module';

type Json = Record<string, any>;

describe('Website content API (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  const m: Record<string, Model<any>> = {};
  const ids: Record<string, Types.ObjectId> = {};

  const past = new Date(Date.now() - 86_400_000);
  const future = new Date(Date.now() + 7 * 86_400_000);

  beforeAll(async () => {
    db = await openTestDb('website');
    const c = db.connection;
    for (const { name, schema } of WEBSITE_MODELS)
      m[name] = c.model(name, schema);
    m.Branch = c.model(Branch.name, BranchSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;

    await db.ready();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [
        WebsitePublicController,
        WebsiteSettingsController,
        ...WEBSITE_CONTENT_CONTROLLERS,
      ],
      providers: [
        WebSermonsService,
        WebContentService,
        WebsiteSettingsService,
        WebsiteAccessService,
        PermissionGuard,
        ...auth.providers,
        ...Object.entries(m).map(([name, model]) => ({
          provide: getModelToken(name),
          useValue: model,
        })),
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();

    // Fixtures
    const [anthony, abuja] = await m.Branch.create([
      { name: 'PPT Anthony', slug: 'ppt-anthony' },
      { name: 'PPT Abuja', slug: 'ppt-abuja' },
    ]);
    ids.anthony = anthony._id;
    ids.abuja = abuja._id;
    const [clarity, hidden] = await m.WebSeries.create([
      {
        title: 'The Law of Clarity',
        slug: 'law-of-clarity',
        startDate: past,
        status: 'published',
      },
      {
        title: 'Unreleased Series',
        slug: 'unreleased',
        startDate: past,
        status: 'draft',
      },
    ]);
    ids.clarity = clarity._id;
    await m.WebSermon.create([
      {
        title: 'Clarity part 1',
        slug: 'clarity-1',
        date: new Date('2026-01-04'),
        service: 'sunday',
        speaker: 'Pastor Dami',
        series: clarity._id,
        partNumber: 1,
        branch: anthony._id,
        status: 'published',
        youtubeId: 'abcdefghijk',
      },
      {
        title: 'Clarity part 2',
        slug: 'clarity-2',
        date: new Date('2026-01-11'),
        service: 'sunday',
        speaker: 'Pastor Dami',
        series: clarity._id,
        partNumber: 2,
        branch: abuja._id,
        status: 'published',
      },
      {
        title: 'Bible study on Grace',
        slug: 'grace',
        date: new Date('2026-01-08'),
        service: 'bible_study',
        speaker: 'Pastor Tolu',
        status: 'published',
      },
      {
        title: 'Draft sermon',
        slug: 'draft',
        date: new Date('2026-01-20'),
        service: 'sunday',
        speaker: 'X',
        series: clarity._id,
        status: 'draft',
      },
      {
        title: 'Scheduled later',
        slug: 'later',
        date: new Date('2026-01-21'),
        service: 'sunday',
        speaker: 'X',
        status: 'published',
        publishAt: future,
      },
      {
        title: 'Scheduled earlier',
        slug: 'earlier',
        date: new Date('2026-01-02'),
        service: 'special',
        speaker: 'Y',
        status: 'published',
        publishAt: past,
      },
      {
        title: 'In hidden series',
        slug: 'hidden-series',
        date: new Date('2026-01-01'),
        service: 'sunday',
        speaker: 'Z',
        series: hidden._id,
        status: 'published',
      },
    ]);
    await m.WebTestimony.create([
      {
        name: 'Approved',
        body: 'yes',
        approved: true,
        status: 'published',
        order: 2,
      },
      {
        name: 'Not approved',
        body: 'no',
        approved: false,
        status: 'published',
        order: 1,
      },
      { name: 'Approved draft', body: 'no', approved: true, status: 'draft' },
    ]);
    await m.WebSnippet.create([
      {
        kind: 'unit',
        name: 'Beckoners',
        body: 'Welcome',
        status: 'published',
        order: 1,
      },
      {
        kind: 'unit',
        name: 'Waves',
        body: 'Music',
        status: 'published',
        order: 0,
      },
      {
        kind: 'tribe_group',
        name: 'Bamboos',
        body: 'Young adults',
        status: 'published',
      },
    ]);
    await m.WebFaq.create([
      {
        page: 'give',
        question: 'How do I give?',
        body: 'Transfer',
        status: 'published',
      },
      { page: 'visit', question: 'Parking?', body: 'Yes', status: 'published' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => (res.body as Json).data;

  // ─── Public ─────────────────────────────────────────────────────────

  describe('public reads', () => {
    it('settings: every key present, null when unset, live success envelope', async () => {
      const res = await http().get('/website/public/settings').expect(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.any(String),
        timestamp: expect.any(String),
      });
      expect(data(res)).toEqual({
        serviceStrip: [],
        platformUrls: {
          youtube: null,
          spotify: null,
          mixlr: null,
          soundcloud: null,
          medium: null,
          instagram: null,
          facebook: null,
          x: null,
        },
        heroVideo: { url: null, posterUrl: null, posterAlt: null },
        dcCohortDate: null,
        contactEmails: {
          general: null,
          finance: null,
          welfare: null,
          media: null,
        },
      });
    });

    it('sermons: only published (or scheduled in the past), newest first, live pagination shape', async () => {
      const res = await http()
        .get('/website/public/sermons?limit=24')
        .expect(200);
      const page = data(res);
      expect(page).toMatchObject({
        total: 5,
        page: 1,
        limit: 24,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(page.data.map((s: Json) => s.slug)).toEqual([
        'clarity-2',
        'grace',
        'clarity-1',
        'earlier',
        'hidden-series',
      ]);
    });

    it('sermons: public shape has refs as {slug,...} and no staff fields', async () => {
      const page = data(await http().get('/website/public/sermons?limit=24'));
      const s1 = page.data.find((s: Json) => s.slug === 'clarity-1');
      expect(s1).toEqual({
        _id: expect.any(String),
        slug: 'clarity-1',
        title: 'Clarity part 1',
        date: '2026-01-04T00:00:00.000Z',
        service: 'sunday',
        speaker: 'Pastor Dami',
        youtubeId: 'abcdefghijk',
        audioUrl: null,
        thumbnailUrl: null,
        durationMin: null,
        partNumber: 1,
        branch: { slug: 'ppt-anthony', name: 'PPT Anthony' },
        series: { slug: 'law-of-clarity', title: 'The Law of Clarity' },
      });
      // A sermon in an unpublished series doesn't leak that series.
      expect(
        page.data.find((s: Json) => s.slug === 'hidden-series').series,
      ).toBeNull();
    });

    it('sermons: service and campus filters really filter (comma lists)', async () => {
      const bs = data(
        await http().get('/website/public/sermons?service=bible_study'),
      );
      expect(bs.data.map((s: Json) => s.slug)).toEqual(['grace']);
      const two = data(
        await http().get(
          '/website/public/sermons?service=sunday,special&limit=24',
        ),
      );
      expect(two.total).toBe(4);
      const abuja = data(
        await http().get('/website/public/sermons?branch=ppt-abuja'),
      );
      expect(abuja.data.map((s: Json) => s.slug)).toEqual(['clarity-2']);
      const unknown = data(
        await http().get('/website/public/sermons?branch=nowhere'),
      );
      expect(unknown.total).toBe(0);
    });

    it('sermons: search matches title, speaker or series title (and is regex-safe)', async () => {
      const bySeries = data(
        await http().get('/website/public/sermons?search=law%20of'),
      );
      expect(bySeries.data.map((s: Json) => s.slug).sort()).toEqual([
        'clarity-1',
        'clarity-2',
      ]);
      const bySpeaker = data(
        await http().get('/website/public/sermons?search=tolu'),
      );
      expect(bySpeaker.data.map((s: Json) => s.slug)).toEqual(['grace']);
      await http()
        .get('/website/public/sermons?search=(a%2B)%2B%24')
        .expect(200);
    });

    it('sermons: sort az and oldest; pages of 2', async () => {
      const az = data(
        await http().get('/website/public/sermons?sort=az&limit=24'),
      );
      expect(az.data[0].slug).toBe('grace');
      const p2 = data(
        await http().get('/website/public/sermons?sort=oldest&limit=2&page=2'),
      );
      expect(p2).toMatchObject({
        page: 2,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
      expect(p2.data.map((s: Json) => s.slug)).toEqual(['clarity-1', 'grace']);
    });

    it('sermons: rejects bad query params', async () => {
      await http().get('/website/public/sermons?limit=25').expect(400);
      await http().get('/website/public/sermons?service=pizza').expect(400);
      await http().get('/website/public/sermons?sort=random').expect(400);
    });

    it('latest sermon, with live=false', async () => {
      const res = data(await http().get('/website/public/sermons/latest'));
      expect(res.sermon.slug).toBe('clarity-2');
      expect(res.live).toEqual({ isLive: false, videoId: null });
    });

    it('series list counts only published parts; draft series hidden', async () => {
      const page = data(await http().get('/website/public/series'));
      expect(page.data).toHaveLength(1);
      expect(page.data[0]).toMatchObject({
        slug: 'law-of-clarity',
        partsCount: 2,
      });
    });

    it('series detail: parts in order; 404 for a draft series', async () => {
      const res = data(
        await http().get('/website/public/series/law-of-clarity'),
      );
      expect(res.series.partsCount).toBe(2);
      expect(res.parts.data.map((s: Json) => s.partNumber)).toEqual([1, 2]);
      const newest = data(
        await http().get('/website/public/series/law-of-clarity?sort=newest'),
      );
      expect(newest.parts.data.map((s: Json) => s.partNumber)).toEqual([2, 1]);
      await http().get('/website/public/series/unreleased').expect(404);
    });

    it('testimonies: only approved AND published', async () => {
      const list = data(await http().get('/website/public/testimonies'));
      expect(list.map((t: Json) => t.name)).toEqual(['Approved']);
      expect(list[0]).not.toHaveProperty('approved');
    });

    it('snippets by kind, in order; kind is required', async () => {
      const units = data(
        await http().get('/website/public/snippets?kind=unit'),
      );
      expect(units.map((u: Json) => u.name)).toEqual(['Waves', 'Beckoners']);
      await http().get('/website/public/snippets').expect(400);
    });

    it('faqs by page; page is required', async () => {
      const give = data(await http().get('/website/public/faqs?page=give'));
      expect(give.map((f: Json) => f.question)).toEqual(['How do I give?']);
      await http().get('/website/public/faqs').expect(400);
    });
  });

  // ─── Staff ──────────────────────────────────────────────────────────

  describe('staff CRUD', () => {
    const sermon = {
      title: 'New Year Word',
      date: '2026-02-01T09:00:00.000Z',
      service: 'sunday',
      speaker: 'Pastor Dami',
    };
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

    it('401 without a token, 403 without the permission', async () => {
      await http().get('/website/sermons').expect(401);
      await http().post('/website/sermons').send(sermon).expect(401);
      const { token } = await staff([P.VIEW_CONTENT]);
      await http()
        .post('/website/sermons')
        .set(bearer(token))
        .send(sermon)
        .expect(403);
      await http().get('/website/sermons').set(bearer(token)).expect(200);
    });

    it('lists include drafts for staff, with filters', async () => {
      const { token } = await staff([P.VIEW_CONTENT]);
      const all = data(
        await http().get('/website/sermons?limit=50').set(bearer(token)),
      );
      expect(all.total).toBe(7);
      const drafts = data(
        await http().get('/website/sermons?status=draft').set(bearer(token)),
      );
      expect(drafts.data.map((s: Json) => s.slug)).toEqual(['draft']);
      const none = data(
        await http()
          .get('/website/sermons?branch=none&limit=50')
          .set(bearer(token)),
      );
      expect(none.total).toBe(5);
    });

    it('creates a draft with just create permission; slug made from the title, then de-duplicated', async () => {
      const { token } = await staff([P.CREATE_CONTENT]);
      const a = data(
        await http()
          .post('/website/sermons')
          .set(bearer(token))
          .send(sermon)
          .expect(201),
      );
      expect(a).toMatchObject({ slug: 'new-year-word', status: 'draft' });
      const b = data(
        await http()
          .post('/website/sermons')
          .set(bearer(token))
          .send(sermon)
          .expect(201),
      );
      expect(b.slug).toBe('new-year-word-2');
      // An explicit slug that's taken is a conflict, not a silent rename.
      await http()
        .post('/website/sermons')
        .set(bearer(token))
        .send({ ...sermon, slug: 'new-year-word' })
        .expect(409);
    });

    it('publishing needs website:publish-content', async () => {
      const writer = await staff([P.CREATE_CONTENT, P.UPDATE_CONTENT]);
      const res = await http()
        .post('/website/sermons')
        .set(bearer(writer.token))
        .send({ ...sermon, status: 'published' })
        .expect(403);
      expect((res.body as Json).message).toContain('website:publish-content');
      await http()
        .post('/website/sermons')
        .set(bearer(writer.token))
        .send({ ...sermon, publishAt: future })
        .expect(403);

      const draft = data(
        await http()
          .post('/website/sermons')
          .set(bearer(writer.token))
          .send(sermon)
          .expect(201),
      );
      // Editing content is fine; changing status is not.
      await http()
        .patch(`/website/sermons/${draft._id}`)
        .set(bearer(writer.token))
        .send({ title: 'Edited' })
        .expect(200);
      await http()
        .patch(`/website/sermons/${draft._id}`)
        .set(bearer(writer.token))
        .send({ status: 'published' })
        .expect(403);

      const publisher = await staff([P.UPDATE_CONTENT, P.PUBLISH_CONTENT]);
      const live = data(
        await http()
          .patch(`/website/sermons/${draft._id}`)
          .set(bearer(publisher.token))
          .send({ status: 'published' })
          .expect(200),
      );
      expect(live).toMatchObject({ status: 'published', title: 'Edited' });
      expect(String(live.updatedBy)).toBe(String(publisher.id));
    });

    it('validates input', async () => {
      const { token } = await staff([P.CREATE_CONTENT]);
      const bad = async (body: Json) =>
        http()
          .post('/website/sermons')
          .set(bearer(token))
          .send({ ...sermon, ...body })
          .expect(400);
      await bad({ youtubeId: 'https://youtu.be/x' });
      await bad({ date: '0001-01-01' });
      await bad({ service: 'midweek' });
      await bad({ audioUrl: 'http://insecure.example.com/a.mp3' });
      await bad({ branch: 'not-an-id' });
      await bad({ title: '' });
    });

    it('null clears a field on PATCH', async () => {
      const { token } = await staff([P.CREATE_CONTENT, P.UPDATE_CONTENT]);
      const doc = data(
        await http()
          .post('/website/sermons')
          .set(bearer(token))
          .send({ ...sermon, branch: String(ids.anthony) })
          .expect(201),
      );
      const upd = data(
        await http()
          .patch(`/website/sermons/${doc._id}`)
          .set(bearer(token))
          .send({ branch: null })
          .expect(200),
      );
      expect(upd.branch).toBeNull();
    });

    it('delete, then 404; malformed ids are 404 too', async () => {
      const { token } = await staff([
        P.CREATE_CONTENT,
        P.DELETE_CONTENT,
        P.VIEW_CONTENT,
      ]);
      const doc = data(
        await http()
          .post('/website/faqs')
          .set(bearer(token))
          .send({ page: 'visit', question: 'Q?', body: 'A' })
          .expect(201),
      );
      await http()
        .delete(`/website/faqs/${doc._id}`)
        .set(bearer(token))
        .expect(200);
      await http()
        .get(`/website/faqs/${doc._id}`)
        .set(bearer(token))
        .expect(404);
      await http()
        .delete(`/website/faqs/${doc._id}`)
        .set(bearer(token))
        .expect(404);
      await http()
        .get('/website/faqs/not-an-id')
        .set(bearer(token))
        .expect(404);
    });

    it('every content resource is wired (create + list)', async () => {
      const { token } = await staff([P.CREATE_CONTENT, P.VIEW_CONTENT]);
      const bodies: Record<string, Json> = {
        series: { title: 'S', startDate: '2026-01-01' },
        devotionals: { title: 'D', date: '2026-01-01' },
        pastors: { name: 'Pastor Dami Oguntunde', role: 'Lead Pastor' },
        testimonies: { name: 'T', body: 'B' },
        snippets: { kind: 'tribe_group', name: 'Pillars', body: 'B' },
        faqs: { page: 'give', question: 'Q', body: 'A' },
      };
      for (const [path, body] of Object.entries(bodies)) {
        await http()
          .post(`/website/${path}`)
          .set(bearer(token))
          .send(body)
          .expect(201);
        await http().get(`/website/${path}`).set(bearer(token)).expect(200);
      }
    });
  });

  describe('settings', () => {
    it('PATCH needs website:manage-settings and merges per key', async () => {
      const viewer = await staff([P.VIEW_CONTENT]);
      await http()
        .patch('/website/settings')
        .set({ Authorization: `Bearer ${viewer.token}` })
        .send({})
        .expect(403);

      const admin = await staff([P.MANAGE_SETTINGS]);
      const auth = { Authorization: `Bearer ${admin.token}` };
      await http()
        .patch('/website/settings')
        .set(auth)
        .send({
          platformUrls: {
            youtube: 'https://youtube.com/@powerpointtribe',
            x: 'https://x.com/Powerpointtribe',
          },
          serviceStrip: [
            { label: 'Sunday Service', day: 'Sundays', time: '9:00am' },
          ],
        })
        .expect(200);
      await http()
        .patch('/website/settings')
        .set(auth)
        .send({
          platformUrls: { x: null, instagram: 'https://instagram.com/ppt' },
        })
        .expect(200);
      await http()
        .patch('/website/settings')
        .set(auth)
        .send({ platformUrls: { youtube: 'http://insecure' } })
        .expect(400);

      const pub = data(await http().get('/website/public/settings'));
      expect(pub.platformUrls).toMatchObject({
        youtube: 'https://youtube.com/@powerpointtribe',
        x: null,
        instagram: 'https://instagram.com/ppt',
      });
      expect(pub.serviceStrip).toEqual([
        { label: 'Sunday Service', day: 'Sundays', time: '9:00am', note: null },
      ]);
    });
  });
});

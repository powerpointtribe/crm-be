import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Connection, Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { EventsWebsiteController } from './events-website.controller';
import { EventsWebsiteService } from './events-website.service';
import { EventsController } from './events.controller';
import { EventsPermission } from './permissions';
import { Event, EventSchema } from './schemas/event.schema';

type Json = Record<string, any>;
const DAY = 86_400_000;

describe('Events on the website (integration)', () => {
  let db: { connection: Connection; close: () => Promise<void> };
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  let events: Model<Event>;

  const at = (days: number) => new Date(Date.now() + days * DAY);
  const ev = (over: Json) => ({
    title: 'Event',
    startDate: at(10),
    endDate: at(10.2),
    status: 'published',
    website: { showOnWebsite: true },
    ...over,
  });

  beforeAll(async () => {
    db = await openTestDb('events_website');
    const c = db.connection;
    events = c.model(Event.name, EventSchema);
    const branches = c.model(Branch.name, BranchSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      // Same order as EventsModule.
      controllers: [EventsWebsiteController, EventsController],
      providers: [
        EventsWebsiteService,
        PermissionGuard,
        ...auth.providers,
        { provide: getModelToken(Event.name), useValue: events },
        { provide: getModelToken(Branch.name), useValue: branches },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();

    const [abuja, anthony] = await branches.create([
      { name: 'PPT Abuja', slug: 'ppt-abuja', timezone: 'Africa/Lagos' },
      { name: 'PPT Anthony', slug: 'ppt-anthony' },
    ]);
    await events.create([
      ev({
        title: 'SOZO',
        registrationSlug: 'sozo',
        startDate: at(30),
        endDate: at(32),
        website: {
          showOnWebsite: true,
          typeLabel: 'Word conference',
          featured: true,
        },
        bannerImage: 'https://img/sozo.jpg',
      }),
      ev({
        title: 'Abuja night',
        startDate: at(5),
        endDate: at(5.1),
        branch: abuja._id,
      }),
      ev({
        title: 'Anthony picnic',
        startDate: at(6),
        endDate: at(6.1),
        branch: anthony._id,
      }),
      ev({
        title: 'Global prayer',
        startDate: at(7),
        endDate: at(7.1),
        isGlobal: true,
        branch: anthony._id,
      }),
      ev({ title: 'Happening now', startDate: at(-0.1), endDate: at(0.1) }),
      ev({ title: 'Ended', startDate: at(-3), endDate: at(-2.9) }),
      ev({ title: 'Draft', status: 'draft' }),
      ev({ title: 'Not opted in', website: { showOnWebsite: false } }),
      {
        title: 'Legacy CRM event',
        startDate: at(4),
        endDate: at(4.1),
        status: 'published',
      },
      ev({
        title: 'Sunday Service',
        website: { showOnWebsite: true, kind: 'weekly_service' },
        startDate: at(-400),
        endDate: at(-399),
      }),
    ]);
    // A document written before the website field existed.
    await events.collection.insertOne({
      title: 'Raw legacy',
      startDate: at(3),
      endDate: at(3.1),
      status: 'published',
    });
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => (res.body as Json).data;

  it('/events/website is not captured by GET /events/:id', async () => {
    const res = await http().get('/events/website').expect(200);
    expect((res.body as Json).success).toBe(true);
  });

  it('lists only published, opted-in, not-ended one-off events, soonest first', async () => {
    const res = data(await http().get('/events/website?limit=24'));
    expect(res.events.data.map((e: Json) => e.title)).toEqual([
      'Happening now',
      'Abuja night',
      'Anthony picnic',
      'Global prayer',
      'SOZO',
    ]);
    expect(res.empty).toBe(false);
    expect(res.events).toMatchObject({ total: 5, page: 1, totalPages: 1 });
  });

  it('public shape', async () => {
    const res = data(await http().get('/events/website?limit=24'));
    const sozo = res.events.data.find((e: Json) => e.slug === 'sozo');
    expect(sozo).toMatchObject({
      slug: 'sozo',
      title: 'SOZO',
      kind: 'one_off',
      typeLabel: 'Word conference',
      featured: true,
      timezone: 'Africa/Lagos',
      image: 'https://img/sozo.jpg',
      link: null,
      branch: null,
    });
    expect(Object.keys(sozo)).not.toContain('registrationSettings');
    expect(Object.keys(sozo)).not.toContain('committee');
    const abuja = res.events.data.find((e: Json) => e.title === 'Abuja night');
    // Events without a registrationSlug fall back to their id.
    expect(abuja.slug).toBe(String(abuja._id));
    expect(abuja.branch).toEqual({ slug: 'ppt-abuja', name: 'PPT Abuja' });
  });

  it('campus filter keeps all-campus events and drops other campuses', async () => {
    const res = data(
      await http().get('/events/website?branch=ppt-abuja&limit=24'),
    );
    expect(res.events.data.map((e: Json) => e.title)).toEqual([
      'Happening now',
      'Abuja night',
      'Global prayer',
      'SOZO',
    ]);
  });

  it('empty is about every campus, not just the filtered one', async () => {
    const res = data(await http().get('/events/website?branch=nowhere'));
    expect(res.events.data.map((e: Json) => e.title)).toContain('SOZO');
    expect(res.empty).toBe(false);
  });

  it('kind=weekly_service lists regardless of date', async () => {
    const res = data(await http().get('/events/website?kind=weekly_service'));
    expect(res.events.data.map((e: Json) => e.title)).toEqual([
      'Sunday Service',
    ]);
  });

  it('next: featured first', async () => {
    const res = data(await http().get('/events/website/next'));
    expect(res.event.title).toBe('SOZO');
  });

  it('rejects bad query params', async () => {
    await http().get('/events/website?limit=100').expect(400);
    await http().get('/events/website?kind=party').expect(400);
    await http().get('/events/website?branch=Not%20A%20Slug').expect(400);
  });

  it('PATCH /events/:id/website: 401, 403, 400, 404, merge', async () => {
    const legacy = await events.findOne({ title: 'Legacy CRM event' }).lean();
    const url = `/events/${String(legacy!._id)}/website`;
    await http().patch(url).send({ showOnWebsite: true }).expect(401);
    const viewer = await staff([EventsPermission.VIEW_EVENTS]);
    await http()
      .patch(url)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ showOnWebsite: true })
      .expect(403);
    const editor = await staff([EventsPermission.UPDATE_EVENT]);
    const auth = { Authorization: `Bearer ${editor.token}` };
    await http()
      .patch(url)
      .set(auth)
      .send({ link: 'javascript:alert(1)' })
      .expect(400);
    await http().patch(url).set(auth).send({ kind: 'party' }).expect(400);
    await http()
      .patch(`/events/${String(new Types.ObjectId())}/website`)
      .set(auth)
      .send({ featured: true })
      .expect(404);

    await http()
      .patch(url)
      .set(auth)
      .send({ showOnWebsite: true, typeLabel: 'Prayer' })
      .expect(200);
    await http().patch(url).set(auth).send({ link: '/visit' }).expect(200);
    const doc = await events.findById(legacy!._id).lean();
    expect(doc!.website).toMatchObject({
      showOnWebsite: true,
      typeLabel: 'Prayer',
      link: '/visit',
      kind: 'one_off',
    });

    const res = data(await http().get('/events/website?limit=24'));
    expect(res.events.data.map((e: Json) => e.title)).toContain(
      'Legacy CRM event',
    );
  });

  it('empty=true when nothing upcoming anywhere', async () => {
    await events.updateMany({}, { $set: { status: 'completed' } });
    const res = data(await http().get('/events/website?branch=ppt-abuja'));
    expect(res).toMatchObject({ empty: true });
    expect(res.events.total).toBe(0);
    expect(data(await http().get('/events/website/next')).event).toBeNull();
  });
});

import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import {
  WebPastor,
  WebPastorSchema,
} from '../website/schemas/web-content.schema';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch, BranchSchema } from './schemas/branch.schema';

type Json = Record<string, any>;

describe('Branch website fields (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  let branches: Model<Branch>;
  let pastors: Model<WebPastor>;

  beforeAll(async () => {
    db = await openTestDb('branch_website');
    const c = db.connection;
    branches = c.model(Branch.name, BranchSchema);
    pastors = c.model(WebPastor.name, WebPastorSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;
    await db.ready();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [BranchesController],
      providers: [
        BranchesService,
        PermissionGuard,
        ...auth.providers,
        { provide: getModelToken(Branch.name), useValue: branches },
        { provide: getModelToken(WebPastor.name), useValue: pastors },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());

  it('existing branches default to off the website (no backfill needed)', async () => {
    // Simulate a production document written before the field existed.
    await branches.collection.insertOne({
      name: 'Legacy',
      slug: 'legacy',
      isActive: true,
    });
    const res = await http().get('/branches/public/website').expect(200);
    expect((res.body as Json).data).toEqual([]);
    // The existing public list is unchanged.
    const old = await http().get('/branches/public').expect(200);
    expect((old.body as Json).data[0]).toEqual({
      name: 'Legacy',
      slug: 'legacy',
    });
  });

  it('PATCH /branches/:id/website: 401, 403, 400, 404', async () => {
    const b = await branches.create({ name: 'PPT Abuja', slug: 'ppt-abuja' });
    const url = `/branches/${String(b._id)}/website`;
    await http().patch(url).send({ showOnWebsite: true }).expect(401);
    const viewer = await staff(['branches:view']);
    await http()
      .patch(url)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ showOnWebsite: true })
      .expect(403);
    const editor = await staff(['branches:update']);
    const auth = { Authorization: `Bearer ${editor.token}` };
    await http()
      .patch(url)
      .set(auth)
      .send({ mapUrl: 'http://maps' })
      .expect(400);
    await http()
      .patch(url)
      .set(auth)
      .send({ serviceTimes: [{ label: 'Sunday' }] })
      .expect(400);
    await http()
      .patch('/branches/64b000000000000000000000/website')
      .set(auth)
      .send({ order: 1 })
      .expect(404);
  });

  it('lists switched-on campuses in order, with only a published pastor', async () => {
    const editor = await staff(['branches:update']);
    const auth = { Authorization: `Bearer ${editor.token}` };
    const [pub, draft] = await pastors.create([
      { name: 'Pastor A', role: 'Campus Pastor', status: 'published' },
      { name: 'Pastor B', role: 'Campus Pastor', status: 'draft' },
    ]);
    const anthony = await branches.create({
      name: 'PPT Anthony',
      slug: 'ppt-anthony',
      isMainBranch: true,
      address: { city: 'Lagos', street: '1 Road' },
    });
    const ikorodu = await branches.create({
      name: 'PPT Ikorodu',
      slug: 'ppt-ikorodu',
    });
    const hidden = await branches.create({
      name: 'Inactive',
      slug: 'inactive',
      isActive: false,
    });

    await http()
      .patch(`/branches/${String(anthony._id)}/website`)
      .set(auth)
      .send({
        showOnWebsite: true,
        order: 2,
        venue: 'Anthony Village',
        mapUrl: 'https://maps.google.com/?q=ppt',
        serviceTimes: [
          { label: 'Sunday Service', day: 'Sundays', time: '9:00am' },
        ],
        pastor: String(pub._id),
      })
      .expect(200);
    await http()
      .patch(`/branches/${String(ikorodu._id)}/website`)
      .set(auth)
      .send({ showOnWebsite: true, order: 1, pastor: String(draft._id) })
      .expect(200);
    await http()
      .patch(`/branches/${String(hidden._id)}/website`)
      .set(auth)
      .send({ showOnWebsite: true })
      .expect(200);

    const res = await http().get('/branches/public/website').expect(200);
    const list = (res.body as Json).data as Json[];
    expect(list.map((b) => b.slug)).toEqual(['ppt-ikorodu', 'ppt-anthony']);
    expect(list[1]).toMatchObject({
      name: 'PPT Anthony',
      venue: 'Anthony Village',
      city: 'Lagos',
      isMain: true,
      mapUrl: 'https://maps.google.com/?q=ppt',
      serviceTimes: [
        { label: 'Sunday Service', day: 'Sundays', time: '9:00am' },
      ],
      pastor: {
        name: 'Pastor A',
        role: 'Campus Pastor',
        photoUrl: null,
        photoAlt: null,
      },
    });
    expect(list[0].pastor).toBeNull();
    expect(list[0]).not.toHaveProperty('settings');
  });

  it('partial PATCH keeps other website fields; null clears one', async () => {
    const editor = await staff(['branches:update']);
    const auth = { Authorization: `Bearer ${editor.token}` };
    const b = await branches.create({ name: 'Merge', slug: 'merge' });
    const url = `/branches/${String(b._id)}/website`;
    await http()
      .patch(url)
      .set(auth)
      .send({ showOnWebsite: true, venue: 'Hall' })
      .expect(200);
    await http().patch(url).set(auth).send({ order: 5 }).expect(200);
    let doc = await branches.findById(b._id).lean();
    expect(doc!.website).toMatchObject({
      showOnWebsite: true,
      venue: 'Hall',
      order: 5,
    });
    await http().patch(url).set(auth).send({ venue: null }).expect(200);
    doc = await branches.findById(b._id).lean();
    expect(doc!.website!.venue).toBeNull();
  });
});

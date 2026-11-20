import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Connection, Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { WebsiteAccessService } from '../website/services/website-access.service';
import { LostFoundPublicController } from './lost-found-public.controller';
import { LostFoundController } from './lost-found.controller';
import { LostFoundService } from './lost-found.service';
import { LostFoundPermission as P } from './permissions';
import {
  LostItemClaim,
  LostItemClaimSchema,
} from './schemas/lost-item-claim.schema';
import { LostItem, LostItemSchema } from './schemas/lost-item.schema';

type Json = Record<string, any>;

describe('Lost & found API (integration)', () => {
  let db: { connection: Connection; close: () => Promise<void> };
  let app: INestApplication;
  let service: LostFoundService;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  let items: Model<any>;
  let claims: Model<any>;
  let anthony: Types.ObjectId;
  let abuja: Types.ObjectId;
  const poster = new Types.ObjectId();
  let ipSeq = 0;
  /** A fresh client IP per request, so the 5/min claim limit doesn't interfere. */
  const ip = () => `10.1.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

  const day = 86_400_000;
  const daysAgo = (n: number) => new Date(Date.now() - n * day);

  beforeAll(async () => {
    db = await openTestDb('lostfound');
    const c = db.connection;
    items = c.model(LostItem.name, LostItemSchema);
    claims = c.model(LostItemClaim.name, LostItemClaimSchema);
    const branches = c.model(Branch.name, BranchSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      ],
      controllers: [LostFoundPublicController, LostFoundController],
      providers: [
        LostFoundService,
        WebsiteAccessService,
        PermissionGuard,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        ...auth.providers,
        { provide: getModelToken(LostItem.name), useValue: items },
        { provide: getModelToken(LostItemClaim.name), useValue: claims },
        { provide: getModelToken(Branch.name), useValue: branches },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();
    service = moduleRef.get(LostFoundService);

    const [a, b] = await branches.create([
      { name: 'PPT Anthony', slug: 'ppt-anthony' },
      { name: 'PPT Abuja', slug: 'ppt-abuja' },
    ]);
    anthony = a._id;
    abuja = b._id;
  });

  beforeEach(async () => {
    await items.deleteMany({});
    await claims.deleteMany({});
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => (res.body as Json).data;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const item = (over: Json = {}) =>
    items.create({
      description: 'Black umbrella',
      type: 'other',
      foundOn: daysAgo(2),
      listedUntil: new Date(Date.now() + 28 * day),
      branch: anthony,
      status: 'listed',
      postedBy: poster,
      ...over,
    });
  const claim = (id: unknown, body: Json = {}, from = ip()) =>
    http()
      .post(`/lost-found/public/items/${String(id)}/claims`)
      .set('X-Forwarded-For', from)
      .send({
        name: 'Ada Obi',
        phone: '+2348031234567',
        proof: 'It has my initials',
        ...body,
      });

  // ─── Public list ────────────────────────────────────────────────────

  describe('GET /lost-found/public/items', () => {
    it('shows listed and claim-pending items only, newest found first, public shape', async () => {
      await item({
        description: 'Old bag',
        type: 'bags',
        foundOn: daysAgo(10),
      });
      await item({
        description: 'Blue bottle',
        type: 'bottles',
        foundOn: daysAgo(1),
        status: 'claim_pending',
        photoUrl: 'https://cdn.test/b.jpg',
      });
      await item({ description: 'Unreviewed', status: 'pending_review' });
      await item({ description: 'Gone', status: 'collected' });
      await item({ description: 'Closet', status: 'moved_to_care_closet' });

      const page = data(
        await http().get('/lost-found/public/items').expect(200),
      );
      expect(page).toMatchObject({
        total: 2,
        page: 1,
        limit: 8,
        totalPages: 1,
      });
      expect(page.data.map((i: Json) => i.name)).toEqual([
        'Blue bottle',
        'Old bag',
      ]);
      expect(page.data[0]).toEqual({
        _id: expect.any(String),
        name: 'Blue bottle',
        type: 'bottles',
        foundOn: expect.any(String),
        photoUrl: 'https://cdn.test/b.jpg',
        status: 'claim_pending',
        branch: { slug: 'ppt-anthony', name: 'PPT Anthony' },
      });
      expect(page.data[1]).toMatchObject({ status: 'waiting', photoUrl: null });
      expect(page.data[1]).not.toHaveProperty('postedBy');
    });

    it('filters by type, campus and search (regex-safe)', async () => {
      await item({ description: 'Red umbrella', type: 'other' });
      await item({ description: 'Car keys', type: 'keys', branch: abuja });
      const keys = data(await http().get('/lost-found/public/items?type=keys'));
      expect(keys.data.map((i: Json) => i.name)).toEqual(['Car keys']);
      const ab = data(
        await http().get('/lost-found/public/items?branch=ppt-abuja'),
      );
      expect(ab.data.map((i: Json) => i.name)).toEqual(['Car keys']);
      const none = data(
        await http().get('/lost-found/public/items?branch=nowhere'),
      );
      expect(none.total).toBe(0);
      const q = data(await http().get('/lost-found/public/items?search=UMBR'));
      expect(q.data.map((i: Json) => i.name)).toEqual(['Red umbrella']);
      await http()
        .get('/lost-found/public/items?search=(a%2B)%2B%24')
        .expect(200);
    });

    it('rejects bad query params', async () => {
      await http().get('/lost-found/public/items?limit=25').expect(400);
      await http().get('/lost-found/public/items?type=pets').expect(400);
    });
  });

  // ─── Public claim ───────────────────────────────────────────────────

  describe('POST /lost-found/public/items/:id/claims', () => {
    it('claims a listed item: 201 with collection instructions, item → claim_pending', async () => {
      const it1 = await item();
      const res = data(await claim(it1._id).expect(201));
      expect(res).toEqual({
        status: 'received',
        instructions:
          'Collect it from the Tribe’s Heart desk at PPT Anthony after Sunday Service. Bring an ID or proof of ownership.',
      });
      expect((await items.findById(it1._id))?.status).toBe('claim_pending');
      const saved = await claims.findOne({ lostItem: it1._id }).lean<Json>();
      expect(saved).toMatchObject({
        status: 'pending',
        proof: 'It has my initials',
        claimant: { name: 'Ada Obi', phone: '+2348031234567' },
      });
    });

    it('409 when the item already has a pending claim', async () => {
      const it1 = await item({ status: 'claim_pending' });
      await claim(it1._id).expect(409);
    });

    it('two concurrent claims: exactly one 201 and one 409', async () => {
      const it1 = await item();
      const results = await Promise.all([claim(it1._id), claim(it1._id)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await claims.countDocuments({ lostItem: it1._id })).toBe(1);
    });

    it('404 for unknown, malformed or non-public items', async () => {
      await claim(new Types.ObjectId()).expect(404);
      await claim('not-an-id').expect(404);
      const pending = await item({ status: 'pending_review' });
      await claim(pending._id).expect(404);
      const gone = await item({ status: 'collected' });
      await claim(gone._id).expect(404);
    });

    it('400 for invalid bodies, without touching the item', async () => {
      const it1 = await item();
      await claim(it1._id, { name: '' }).expect(400);
      await claim(it1._id, { name: 'x'.repeat(61) }).expect(400);
      await claim(it1._id, { phone: 'call me' }).expect(400);
      await claim(it1._id, { proof: 'mine' }).expect(400);
      await claim(it1._id, { proof: 'x'.repeat(501) }).expect(400);
      expect((await items.findById(it1._id))?.status).toBe('listed');
    });

    it('accepts common phone formats', async () => {
      for (const phone of [
        '0803 123 4567',
        '(0803) 123-4567',
        '+44 20 7946 0958',
      ]) {
        const it1 = await item();
        await claim(it1._id, { phone }).expect(201);
      }
    });

    it('honeypot: same success reply, nothing stored, item unchanged', async () => {
      const it1 = await item();
      const res = data(
        await claim(it1._id, { website: 'http://spam.example' }).expect(201),
      );
      expect(res.status).toBe('received');
      expect(res.instructions).toContain('PPT Anthony');
      expect(await claims.countDocuments()).toBe(0);
      expect((await items.findById(it1._id))?.status).toBe('listed');
    });

    it('rolls the item back to listed if saving the claim fails', async () => {
      const it1 = await item();
      const spy = jest
        .spyOn(claims, 'create')
        .mockRejectedValueOnce(new Error('db down'));
      await claim(it1._id).expect(500);
      spy.mockRestore();
      expect((await items.findById(it1._id))?.status).toBe('listed');
    });

    it('limits claims to 5 per minute per IP', async () => {
      const from = '10.200.0.1';
      for (let i = 0; i < 5; i++) {
        const it1 = await item();
        await claim(it1._id, {}, from).expect(201);
      }
      const it6 = await item();
      await claim(it6._id, {}, from).expect(429);
      await claim(it6._id, {}, '10.200.0.2').expect(201);
    });
  });

  // ─── Staff: items ───────────────────────────────────────────────────

  describe('staff items', () => {
    const body = (over: Json = {}) => ({
      description: 'Grey hoodie',
      type: 'clothing',
      foundOn: daysAgo(1).toISOString(),
      branch: String(anthony),
      ...over,
    });

    it('401 without a token, 403 without the permission', async () => {
      await http().post('/lost-found/items').send(body()).expect(401);
      const viewer = await staff([P.VIEW_ITEMS]);
      await http()
        .post('/lost-found/items')
        .set(bearer(viewer.token))
        .send(body())
        .expect(403);
      const poster2 = await staff([P.CREATE_ITEM]);
      await http()
        .get('/lost-found/items')
        .set(bearer(poster2.token))
        .expect(403);
      await http()
        .get('/lost-found/claims')
        .set(bearer(poster2.token))
        .expect(403);
    });

    it('workforce posts go to review (not public), with listedUntil = foundOn + 30 days', async () => {
      const w = await staff([P.CREATE_ITEM]);
      const doc = data(
        await http()
          .post('/lost-found/items')
          .set(bearer(w.token))
          .send(body())
          .expect(201),
      );
      expect(doc).toMatchObject({
        status: 'pending_review',
        postedBy: String(w.id),
      });
      expect(
        new Date(doc.listedUntil).getTime() - new Date(doc.foundOn).getTime(),
      ).toBe(30 * day);
      expect(data(await http().get('/lost-found/public/items')).total).toBe(0);
    });

    it('listing straight away needs lost-found:manage', async () => {
      const w = await staff([P.CREATE_ITEM]);
      const res = await http()
        .post('/lost-found/items')
        .set(bearer(w.token))
        .send(body({ status: 'listed' }))
        .expect(403);
      expect((res.body as Json).message).toContain('lost-found:manage');
      const desk = await staff([P.CREATE_ITEM, P.MANAGE_ITEMS]);
      const doc = data(
        await http()
          .post('/lost-found/items')
          .set(bearer(desk.token))
          .send(body({ status: 'listed' }))
          .expect(201),
      );
      expect(doc.status).toBe('listed');
    });

    it('validates input', async () => {
      const w = await staff([P.CREATE_ITEM]);
      const bad = (over: Json) =>
        http()
          .post('/lost-found/items')
          .set(bearer(w.token))
          .send(body(over))
          .expect(400);
      await bad({ type: 'pets' });
      await bad({ description: 'ab' });
      await bad({ foundOn: new Date(Date.now() + 3 * day).toISOString() });
      await bad({ foundOn: '0001-01-01' });
      await bad({ branch: 'nope' });
      await bad({ branch: String(new Types.ObjectId()) });
      await bad({ photoUrl: 'http://insecure.test/a.jpg' });
      await bad({ status: 'collected' });
    });

    it('items/mine returns only your posts', async () => {
      const a = await staff([P.CREATE_ITEM]);
      const b = await staff([P.CREATE_ITEM]);
      await http()
        .post('/lost-found/items')
        .set(bearer(a.token))
        .send(body({ description: 'Mine A' }))
        .expect(201);
      await http()
        .post('/lost-found/items')
        .set(bearer(b.token))
        .send(body({ description: 'Mine B' }))
        .expect(201);
      const mine = data(
        await http()
          .get('/lost-found/items/mine')
          .set(bearer(a.token))
          .expect(200),
      );
      expect(mine.map((i: Json) => i.description)).toEqual(['Mine A']);
    });

    it('review flow: desk lists a pending item; status moves are validated', async () => {
      const desk = await staff([P.VIEW_ITEMS, P.MANAGE_ITEMS]);
      const pending = await item({ status: 'pending_review' });
      const listed = data(
        await http()
          .patch(`/lost-found/items/${String(pending._id)}`)
          .set(bearer(desk.token))
          .send({ status: 'listed' })
          .expect(200),
      );
      expect(listed.status).toBe('listed');
      expect(data(await http().get('/lost-found/public/items')).total).toBe(1);

      // Can't go straight from pending_review to collected...
      const p2 = await item({ status: 'pending_review' });
      await http()
        .patch(`/lost-found/items/${String(p2._id)}`)
        .set(bearer(desk.token))
        .send({ status: 'collected' })
        .expect(409);
      // ...nor change an item that has a pending claim.
      const cp = await item({ status: 'claim_pending' });
      const res = await http()
        .patch(`/lost-found/items/${String(cp._id)}`)
        .set(bearer(desk.token))
        .send({ status: 'listed' })
        .expect(409);
      expect((res.body as Json).message).toContain('pending claim');
      await http()
        .delete(`/lost-found/items/${String(cp._id)}`)
        .set(bearer(desk.token))
        .expect(409);
    });

    it('changing foundOn recomputes listedUntil', async () => {
      const desk = await staff([P.MANAGE_ITEMS]);
      const it1 = await item();
      const foundOn = daysAgo(5);
      const doc = data(
        await http()
          .patch(`/lost-found/items/${String(it1._id)}`)
          .set(bearer(desk.token))
          .send({ foundOn: foundOn.toISOString() })
          .expect(200),
      );
      expect(new Date(doc.listedUntil).getTime()).toBe(
        foundOn.getTime() + 30 * day,
      );
    });

    it('list with filters; get; delete; 404s', async () => {
      const desk = await staff([P.VIEW_ITEMS, P.MANAGE_ITEMS]);
      await item({ description: 'Listed one' });
      const p = await item({
        description: 'Pending one',
        status: 'pending_review',
      });
      const pendingOnly = data(
        await http()
          .get('/lost-found/items?status=pending_review')
          .set(bearer(desk.token))
          .expect(200),
      );
      expect(pendingOnly.data.map((i: Json) => i.description)).toEqual([
        'Pending one',
      ]);
      await http()
        .get(`/lost-found/items/${String(p._id)}`)
        .set(bearer(desk.token))
        .expect(200);
      await http()
        .delete(`/lost-found/items/${String(p._id)}`)
        .set(bearer(desk.token))
        .expect(200);
      await http()
        .get(`/lost-found/items/${String(p._id)}`)
        .set(bearer(desk.token))
        .expect(404);
      await http()
        .get('/lost-found/items/not-an-id')
        .set(bearer(desk.token))
        .expect(404);
    });
  });

  // ─── Staff: claims ──────────────────────────────────────────────────

  describe('staff claims', () => {
    it('phones are masked unless you may manage claims', async () => {
      const it1 = await item();
      await claim(it1._id).expect(201);
      const viewer = await staff([P.VIEW_CLAIMS]);
      const masked = data(
        await http()
          .get('/lost-found/claims')
          .set(bearer(viewer.token))
          .expect(200),
      );
      expect(masked.data[0].claimant).toEqual({
        name: 'Ada Obi',
        phone: '+234*****67',
      });
      expect(masked.data[0].lostItem).toMatchObject({
        description: 'Black umbrella',
        branch: { name: 'PPT Anthony' },
      });

      const desk = await staff([P.VIEW_CLAIMS, P.MANAGE_CLAIMS]);
      const full = data(
        await http()
          .get('/lost-found/claims')
          .set(bearer(desk.token))
          .expect(200),
      );
      expect(full.data[0].claimant.phone).toBe('+2348031234567');
    });

    it('approve → item collected; a second review is a 409', async () => {
      const desk = await staff([P.MANAGE_CLAIMS]);
      const it1 = await item();
      await claim(it1._id).expect(201);
      const c = await claims.findOne({ lostItem: it1._id });
      const res = data(
        await http()
          .patch(`/lost-found/claims/${String(c!._id)}`)
          .set(bearer(desk.token))
          .send({ status: 'approved' })
          .expect(200),
      );
      expect(res).toMatchObject({
        status: 'approved',
        reviewedBy: String(desk.id),
      });
      expect((await items.findById(it1._id))?.status).toBe('collected');
      await http()
        .patch(`/lost-found/claims/${String(c!._id)}`)
        .set(bearer(desk.token))
        .send({ status: 'rejected' })
        .expect(409);
    });

    it('reject → item listed again and claimable', async () => {
      const desk = await staff([P.MANAGE_CLAIMS]);
      const it1 = await item();
      await claim(it1._id).expect(201);
      const c = await claims.findOne({ lostItem: it1._id });
      await http()
        .patch(`/lost-found/claims/${String(c!._id)}`)
        .set(bearer(desk.token))
        .send({ status: 'rejected' })
        .expect(200);
      expect((await items.findById(it1._id))?.status).toBe('listed');
      await claim(it1._id).expect(201);
    });

    it('400 for a bad status, 404 for an unknown claim, 403 for view-only', async () => {
      const desk = await staff([P.MANAGE_CLAIMS]);
      const viewer = await staff([P.VIEW_CLAIMS]);
      const id = String(new Types.ObjectId());
      await http()
        .patch(`/lost-found/claims/${id}`)
        .set(bearer(desk.token))
        .send({ status: 'pending' })
        .expect(400);
      await http()
        .patch(`/lost-found/claims/${id}`)
        .set(bearer(desk.token))
        .send({ status: 'approved' })
        .expect(404);
      await http()
        .patch(`/lost-found/claims/${id}`)
        .set(bearer(viewer.token))
        .send({ status: 'approved' })
        .expect(403);
    });
  });

  // ─── Expiry job ─────────────────────────────────────────────────────

  it('expireListedItems moves only listed items past listedUntil to the Care Closet', async () => {
    const old = await item({ listedUntil: daysAgo(1) });
    const fresh = await item({ listedUntil: new Date(Date.now() + day) });
    const claimed = await item({
      status: 'claim_pending',
      listedUntil: daysAgo(1),
    });
    const pending = await item({
      status: 'pending_review',
      listedUntil: daysAgo(1),
    });
    expect(await service.expireListedItems()).toBe(1);
    const statuses = await Promise.all(
      [old, fresh, claimed, pending].map(
        async (d) => (await items.findById(d._id))?.status,
      ),
    );
    expect(statuses).toEqual([
      'moved_to_care_closet',
      'listed',
      'claim_pending',
      'pending_review',
    ]);
  });
});

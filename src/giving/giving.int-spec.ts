import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import {
  staffAuthHarness,
  TEST_JWT_SECRET,
} from '../test-utils/staff-auth-spec';
import { GivingPublicController } from './controllers/giving-public.controller';
import {
  DonationsController,
  GivingAccountsController,
} from './controllers/giving-staff.controller';
import { GIVING_MODELS } from './giving.module';
import { GivingPermission as P } from './permissions';
import { DonationsService } from './services/donations.service';
import { FlutterwaveClient } from './services/flutterwave.client';
import { GivingAccountsService } from './services/giving-accounts.service';

type Json = Record<string, any>;

describe('Giving API (integration)', () => {
  let db: { connection: Connection; close: () => Promise<void> };
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  const m: Record<string, Model<any>> = {};
  const config: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;
  let calls: { url: string; body?: Json }[];
  let verified: Record<string, Json>;
  let paymentsReply: () => Response | Promise<Response>;
  let anthony: Types.ObjectId;
  let abuja: Types.ObjectId;

  const resetConfig = () => {
    for (const k of Object.keys(config)) delete config[k];
    Object.assign(config, {
      JWT_SECRET: TEST_JWT_SECRET,
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-x',
      WEBSITE_URL: 'https://site.test',
    });
  };

  beforeAll(async () => {
    resetConfig();
    db = await openTestDb('giving');
    const c = db.connection;
    for (const { name, schema } of GIVING_MODELS)
      m[name] = c.model(name, schema);
    m.Branch = c.model(Branch.name, BranchSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      ],
      controllers: [
        GivingPublicController,
        GivingAccountsController,
        DonationsController,
      ],
      providers: [
        GivingAccountsService,
        DonationsService,
        FlutterwaveClient,
        PermissionGuard,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        ...auth.providers.filter(
          (p) => (p as { provide?: unknown }).provide !== ConfigService,
        ),
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: unknown) => config[k] ?? d },
        },
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

    const [a, b] = await m.Branch.create([
      { name: 'PPT Anthony', slug: 'ppt-anthony' },
      { name: 'PPT Abuja', slug: 'ppt-abuja' },
    ]);
    anthony = a._id;
    abuja = b._id;
  });

  beforeEach(() => {
    resetConfig();
    calls = [];
    verified = {};
    paymentsReply = () =>
      Response.json({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.test/pay/x' },
      });
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: any, init?: any) => {
        const url = String(input);
        calls.push({
          url,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (url.endsWith('/payments')) return paymentsReply();
        const ref = new URL(url).searchParams.get('tx_ref') ?? '';
        return verified[ref]
          ? Response.json({ status: 'success', data: verified[ref] })
          : Response.json({
              status: 'error',
              message: 'No transaction was found for this id',
            });
      });
  });

  afterEach(() => fetchMock.mockRestore());

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());
  const data = (res: request.Response) => (res.body as Json).data;
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  let ip = 0;
  /** Fresh client IP per request group, so throttling tests don't interfere. */
  const fromNewIp = () => `10.1.0.${++ip}`;
  const gift = {
    fund: 'tithe',
    branch: 'ppt-anthony',
    amount: 5000,
    email: 'giver@example.com',
    name: 'Ada',
  };

  // ─── Accounts: maker / checker ──────────────────────────────────────

  describe('giving accounts', () => {
    const naira = {
      currency: 'NGN',
      bank: 'Zenith Bank Plc',
      accountNumber: '1221642022',
      accountName: 'The Powerpoint Tribesmen Chris. Min.',
    };

    it('401 without a token, 403 without permission', async () => {
      await http().get('/giving/accounts').expect(401);
      const viewer = await staff([P.VIEW_ACCOUNTS]);
      await http()
        .post('/giving/accounts')
        .set(bearer(viewer.token))
        .send(naira)
        .expect(403);
    });

    it('validates account details', async () => {
      const maker = await staff([P.MANAGE_ACCOUNTS]);
      const bad = (body: Json) =>
        http()
          .post('/giving/accounts')
          .set(bearer(maker.token))
          .send({ ...naira, ...body })
          .expect(400);
      await bad({ accountNumber: '12345' });
      await bad({ accountNumber: '12-345-678' });
      await bad({ currency: 'JPY' });
      await bad({ swift: 'ABC' });
      await bad({ branch: 'anthony' });
    });

    it('drafts are hidden until someone else approves them', async () => {
      const maker = await staff([P.MANAGE_ACCOUNTS, P.APPROVE_ACCOUNTS]);
      const checker = await staff([P.APPROVE_ACCOUNTS]);
      const draft = data(
        await http()
          .post('/giving/accounts')
          .set(bearer(maker.token))
          .send({ ...naira, branch: String(anthony) })
          .expect(201),
      );
      expect(draft.approvalStatus).toBe('draft');
      expect(data(await http().get('/giving/public/accounts'))).toHaveLength(0);

      // Maker can't approve their own draft, even with the approve permission.
      const own = await http()
        .post(`/giving/accounts/${draft._id}/approve`)
        .set(bearer(maker.token))
        .expect(403);
      expect((own.body as Json).message).toContain('Someone else');
      await http()
        .post(`/giving/accounts/${draft._id}/approve`)
        .set(bearer(checker.token))
        .expect(201);
      // Nothing left to approve.
      await http()
        .post(`/giving/accounts/${draft._id}/approve`)
        .set(bearer(checker.token))
        .expect(409);

      const pub = data(await http().get('/giving/public/accounts'));
      expect(pub).toEqual([
        {
          _id: draft._id,
          currency: 'NGN',
          bank: 'Zenith Bank Plc',
          accountNumber: '1221642022',
          accountName: 'The Powerpoint Tribesmen Chris. Min.',
          swift: null,
          branch: { slug: 'ppt-anthony', name: 'PPT Anthony' },
        },
      ]);
    });

    it('changes to an approved account stay pending; the public sees the old values', async () => {
      const maker = await staff([P.MANAGE_ACCOUNTS]);
      const checker = await staff([
        P.APPROVE_ACCOUNTS,
        P.MANAGE_ACCOUNTS,
        P.VIEW_ACCOUNTS,
      ]);
      const acc = data(
        await http()
          .post('/giving/accounts')
          .set(bearer(maker.token))
          .send({
            ...naira,
            accountNumber: '0230914600',
            branch: String(abuja),
          })
          .expect(201),
      );
      await http()
        .post(`/giving/accounts/${acc._id}/approve`)
        .set(bearer(checker.token))
        .expect(201);

      await http()
        .patch(`/giving/accounts/${acc._id}`)
        .set(bearer(maker.token))
        .send({ accountNumber: '9999999999' })
        .expect(200);
      await http()
        .patch(`/giving/accounts/${acc._id}`)
        .set(bearer(maker.token))
        .send({ bank: 'Union Bank' })
        .expect(200);
      const pending = data(
        await http()
          .get(`/giving/accounts/${acc._id}`)
          .set(bearer(checker.token)),
      );
      expect(pending.pendingChange.fields).toEqual({
        accountNumber: '9999999999',
        bank: 'Union Bank',
      });

      const pubBefore = data(
        await http().get('/giving/public/accounts?branch=ppt-abuja'),
      );
      expect(pubBefore.find((a: Json) => a._id === acc._id)).toMatchObject({
        accountNumber: '0230914600',
        bank: 'Zenith Bank Plc',
      });

      await http()
        .post(`/giving/accounts/${acc._id}/approve`)
        .set(bearer(maker.token))
        .expect(403);
      await http()
        .post(`/giving/accounts/${acc._id}/approve`)
        .set(bearer(checker.token))
        .expect(201);
      const pubAfter = data(
        await http().get('/giving/public/accounts?branch=ppt-abuja'),
      );
      expect(pubAfter.find((a: Json) => a._id === acc._id)).toMatchObject({
        accountNumber: '9999999999',
        bank: 'Union Bank',
      });

      // Reject drops a pending change; nothing pending is a 409.
      await http()
        .patch(`/giving/accounts/${acc._id}`)
        .set(bearer(maker.token))
        .send({ bank: 'Typo Bank' })
        .expect(200);
      await http()
        .post(`/giving/accounts/${acc._id}/reject`)
        .set(bearer(checker.token))
        .expect(201);
      await http()
        .post(`/giving/accounts/${acc._id}/reject`)
        .set(bearer(checker.token))
        .expect(409);
      expect(
        data(
          await http()
            .get(`/giving/accounts/${acc._id}`)
            .set(bearer(checker.token)),
        ).bank,
      ).toBe('Union Bank');

      // Approved accounts can't be deleted; drafts can.
      await http()
        .delete(`/giving/accounts/${acc._id}`)
        .set(bearer(maker.token))
        .expect(409);
    });

    it('campus filter = that campus + shared accounts; shared listed last', async () => {
      const maker = await staff([P.MANAGE_ACCOUNTS]);
      const checker = await staff([P.APPROVE_ACCOUNTS]);
      const usd = data(
        await http()
          .post('/giving/accounts')
          .set(bearer(maker.token))
          .send({
            currency: 'USD',
            bank: 'Zenith Bank Plc',
            accountNumber: '5072274115',
            swift: 'zeibngla',
          })
          .expect(201),
      );
      await http()
        .post(`/giving/accounts/${usd._id}/approve`)
        .set(bearer(checker.token))
        .expect(201);

      const all = data(await http().get('/giving/public/accounts'));
      expect(all.at(-1)).toMatchObject({
        currency: 'USD',
        swift: 'ZEIBNGLA',
        branch: null,
      });
      expect(all.map((a: Json) => a.branch?.slug ?? null)).toEqual([
        'ppt-abuja',
        'ppt-anthony',
        null,
      ]);

      const anthonyOnly = data(
        await http().get('/giving/public/accounts?branch=ppt-anthony'),
      );
      expect(anthonyOnly.map((a: Json) => a.branch?.slug ?? null)).toEqual([
        'ppt-anthony',
        null,
      ]);
      const unknown = data(
        await http().get('/giving/public/accounts?branch=nowhere'),
      );
      expect(unknown.map((a: Json) => a.currency)).toEqual(['USD']);
      await http().get('/giving/public/accounts?branch=Bad%20Slug').expect(400);
    });

    it('404 for unknown or malformed ids', async () => {
      const viewer = await staff([P.VIEW_ACCOUNTS]);
      await http()
        .get(`/giving/accounts/${String(new Types.ObjectId())}`)
        .set(bearer(viewer.token))
        .expect(404);
      await http()
        .get('/giving/accounts/nope')
        .set(bearer(viewer.token))
        .expect(404);
    });
  });

  // ─── Donations: public ──────────────────────────────────────────────

  describe('online giving', () => {
    it('providers: Flutterwave only when its key is set', async () => {
      expect(data(await http().get('/giving/public/providers'))).toEqual([
        { id: 'flutterwave', label: 'Flutterwave' },
      ]);
      delete config.FLUTTERWAVE_SECRET_KEY;
      expect(data(await http().get('/giving/public/providers'))).toEqual([]);
    });

    it('starts a gift: pending donation + Flutterwave link back to the website', async () => {
      const res = data(
        await http()
          .post('/giving/public/donations')
          .set('X-Forwarded-For', fromNewIp())
          .send({ ...gift, source: { page: '/give', utm: { source: 'ig' } } })
          .expect(201),
      );
      expect(res.reference).toMatch(/^PPTG-[0-9a-f]{24}$/);
      expect(res.paymentLink).toBe('https://checkout.flutterwave.test/pay/x');
      const sent = calls.find((c) => c.url.endsWith('/payments'))!.body!;
      expect(sent).toMatchObject({
        tx_ref: res.reference,
        amount: 5000,
        currency: 'NGN',
        redirect_url: `https://site.test/give/thank-you?reference=${res.reference}`,
        customer: { email: 'giver@example.com', name: 'Ada' },
      });
      expect(
        await m.Donation.findOne({ reference: res.reference }).lean(),
      ).toMatchObject({
        status: 'pending',
        fund: 'tithe',
        amount: 5000,
        branch: anthony,
        donor: { email: 'giver@example.com', name: 'Ada' },
        source: { page: '/give', utm: { source: 'ig' } },
      });
    });

    it('validates the gift', async () => {
      const bad = (body: Json) =>
        http()
          .post('/giving/public/donations')
          .set('X-Forwarded-For', fromNewIp())
          .send({ ...gift, ...body })
          .expect(400);
      await bad({ amount: 99 });
      await bad({ amount: 10_000_001 });
      await bad({ amount: 100.5 });
      await bad({ fund: 'building' });
      await bad({ email: 'nope' });
      await bad({ branch: 'nowhere' }); // unknown campus
      await bad({ source: { page: 'https://evil.test' } });
      expect(calls).toHaveLength(0);
    });

    it('honeypot: filled "website" is a 400 and creates nothing', async () => {
      const before = await m.Donation.countDocuments();
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', fromNewIp())
        .send({ ...gift, website: 'http://spam' })
        .expect(400);
      expect(await m.Donation.countDocuments()).toBe(before);
      expect(calls).toHaveLength(0);
    });

    it('503 when online giving is not configured', async () => {
      delete config.FLUTTERWAVE_SECRET_KEY;
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', fromNewIp())
        .send(gift)
        .expect(503);
      resetConfig();
      delete config.WEBSITE_URL;
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', fromNewIp())
        .send(gift)
        .expect(503);
    });

    it('502 when Flutterwave refuses or is down; the donation is marked failed', async () => {
      paymentsReply = () =>
        Response.json({ status: 'error', message: 'Invalid key' });
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', fromNewIp())
        .send({ ...gift, email: 'refused@example.com' })
        .expect(502);
      expect(
        await m.Donation.findOne({
          'donor.email': 'refused@example.com',
        }).lean(),
      ).toMatchObject({ status: 'failed', failureReason: 'provider_error' });
      paymentsReply = () => Promise.reject(new TypeError('fetch failed'));
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', fromNewIp())
        .send(gift)
        .expect(502);
    });

    it('limits starting gifts to 10 per minute per IP', async () => {
      const ipAddr = fromNewIp();
      for (let i = 0; i < 10; i++) {
        await http()
          .post('/giving/public/donations')
          .set('X-Forwarded-For', ipAddr)
          .send(gift)
          .expect(201);
      }
      await http()
        .post('/giving/public/donations')
        .set('X-Forwarded-For', ipAddr)
        .send(gift)
        .expect(429);
    });
  });

  describe('donation status', () => {
    const newDonation = async (extra: Json = {}) => {
      const reference = `PPTG-${new Types.ObjectId().toHexString()}`;
      await m.Donation.create({
        reference,
        fund: 'offering',
        amount: 2500,
        branch: anthony,
        donor: { email: 'p@example.com' },
        ...extra,
      });
      return reference;
    };
    const status = (ref: string) =>
      http().get(`/giving/public/donations/${ref}/status`);

    it('400 for a malformed reference, 404 for an unknown one', async () => {
      await status('PPTS-123').expect(400);
      await status(`PPTG-${'A'.repeat(24)}`).expect(400);
      await status(`PPTG-${'a'.repeat(24)}`).expect(404);
    });

    it('settles when Flutterwave confirms the same amount, with a receipt number', async () => {
      const ref = await newDonation();
      expect(data(await status(ref).expect(200))).toMatchObject({
        status: 'pending',
        receiptNo: null,
      });
      // Lift the 10 s throttle for the next check.
      await m.Donation.updateOne(
        { reference: ref },
        { $set: { lastCheckedAt: new Date(0) } },
      );
      verified[ref] = {
        id: 42,
        tx_ref: ref,
        status: 'successful',
        amount: 2500,
        currency: 'NGN',
      };
      const ok = data(await status(ref).expect(200));
      expect(ok).toEqual({
        reference: ref,
        status: 'successful',
        amount: 2500,
        currency: 'NGN',
        fund: 'offering',
        receiptNo: expect.stringMatching(/^PPT-\d{4}-\d{6}$/),
      });
      expect(await m.Donation.findOne({ reference: ref }).lean()).toMatchObject(
        { flutterwaveTxId: '42' },
      );
      // Settled: no more provider calls, receipt never changes.
      calls = [];
      expect(data(await status(ref)).receiptNo).toBe(ok.receiptNo);
      expect(calls).toHaveLength(0);
    });

    it('asks Flutterwave at most once every 10 s, however often the page polls', async () => {
      const ref = await newDonation();
      await Promise.all([status(ref), status(ref), status(ref), status(ref)]);
      await status(ref);
      expect(calls.filter((c) => c.url.includes(ref))).toHaveLength(1);
    });

    it('amount mismatch fails the donation instead of crediting it', async () => {
      const ref = await newDonation();
      verified[ref] = {
        id: 7,
        tx_ref: ref,
        status: 'successful',
        amount: 25,
        currency: 'NGN',
      };
      expect(data(await status(ref))).toMatchObject({
        status: 'failed',
        receiptNo: null,
      });
      expect(await m.Donation.findOne({ reference: ref }).lean()).toMatchObject(
        { failureReason: 'amount_mismatch' },
      );
      const usd = await newDonation();
      verified[usd] = {
        id: 8,
        tx_ref: usd,
        status: 'successful',
        amount: 2500,
        currency: 'USD',
      };
      expect(data(await status(usd)).status).toBe('failed');
    });

    it('receipt numbers are unique under concurrent settlement, even for the first of the year', async () => {
      // No counter yet: several settlements create it at the same time.
      await m.GivingCounter.deleteMany({});
      await m.Donation.deleteMany({ receiptNo: { $exists: true } });
      const refs = await Promise.all(
        Array.from({ length: 6 }, () => newDonation()),
      );
      for (const r of refs)
        verified[r] = {
          id: 1,
          tx_ref: r,
          status: 'successful',
          amount: 2500,
          currency: 'NGN',
        };
      await Promise.all(refs.flatMap((r) => [status(r), status(r)]));
      const receipts = (
        await m.Donation.find({ reference: { $in: refs } }).lean()
      ).map((d) => d.receiptNo);
      expect(new Set(receipts).size).toBe(6);
      expect(receipts.every((r) => /^PPT-\d{4}-\d{6}$/.test(r))).toBe(true);
    });

    it('a successful donation that missed its receipt number gets one on the next read', async () => {
      const ref = await newDonation({
        status: 'successful',
        verifiedAt: new Date(),
      });
      expect(data(await status(ref)).receiptNo).toMatch(/^PPT-\d{4}-\d{6}$/);
    });
  });

  // ─── Donations: staff ───────────────────────────────────────────────

  describe('staff donation views', () => {
    beforeAll(async () => {
      await m.Donation.create([
        {
          reference: `PPTG-${new Types.ObjectId().toHexString()}`,
          fund: 'tithe',
          amount: 1000,
          branch: anthony,
          donor: { email: 'a@x.co', name: '=HYPERLINK("http://evil")' },
          status: 'successful',
          receiptNo: 'PPT-2026-900001',
        },
        {
          reference: `PPTG-${new Types.ObjectId().toHexString()}`,
          fund: 'tithe',
          amount: 3000,
          branch: abuja,
          donor: { email: 'b@x.co' },
          status: 'successful',
          receiptNo: 'PPT-2026-900002',
        },
        {
          reference: `PPTG-${new Types.ObjectId().toHexString()}`,
          fund: 'project',
          amount: 9999,
          branch: abuja,
          donor: { email: 'c@x.co' },
          status: 'failed',
        },
      ]);
    });

    it('list needs giving:view-donations and shows donor contact', async () => {
      const totalsOnly = await staff([P.VIEW_DONATION_TOTALS]);
      await http()
        .get('/giving/donations')
        .set(bearer(totalsOnly.token))
        .expect(403);
      const viewer = await staff([P.VIEW_DONATIONS]);
      const page = data(
        await http()
          .get('/giving/donations?fund=tithe&status=successful')
          .set(bearer(viewer.token))
          .expect(200),
      );
      expect(page.data.length).toBeGreaterThanOrEqual(2);
      expect(page.data[0].donor.email).toBeDefined();
      const one = data(
        await http()
          .get('/giving/donations?search=900002')
          .set(bearer(viewer.token)),
      );
      expect(one.data.map((d: Json) => d.receiptNo)).toEqual([
        'PPT-2026-900002',
      ]);
      await http()
        .get('/giving/donations?search=(a%2B)%2B%24')
        .set(bearer(viewer.token))
        .expect(200);
    });

    it('totals: successful only, by currency and fund, without donor data', async () => {
      const t = await staff([P.VIEW_DONATION_TOTALS]);
      const rows = data(
        await http()
          .get('/giving/donations/totals')
          .set(bearer(t.token))
          .expect(200),
      );
      const tithe = rows.find((r: Json) => r.fund === 'tithe');
      expect(Object.keys(tithe).sort()).toEqual([
        'count',
        'currency',
        'fund',
        'total',
      ]);
      expect(rows.find((r: Json) => r.fund === 'project')).toBeUndefined();
      const future = data(
        await http()
          .get('/giving/donations/totals?from=2100-01-01')
          .set(bearer(t.token)),
      );
      expect(future).toEqual([]);
      const anon = await staff([]);
      await http()
        .get('/giving/donations/totals')
        .set(bearer(anon.token))
        .expect(403);
    });

    it('CSV export is permission-gated, attached and formula-safe', async () => {
      const viewer = await staff([P.VIEW_DONATIONS]);
      await http()
        .get('/giving/donations/export')
        .set(bearer(viewer.token))
        .expect(403);
      const exporter = await staff([P.EXPORT_DONATIONS]);
      const res = await http()
        .get('/giving/donations/export?status=successful')
        .set(bearer(exporter.token))
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="donations.csv"',
      );
      const csv = res.text;
      expect(csv.split('\r\n')[0]).toBe(
        '"Receipt","Reference","Date","Status","Fund","Amount","Currency","Campus","Name","Email","Phone"',
      );
      expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
      expect(csv).not.toContain(',"=HYPERLINK');
      expect(csv).not.toContain('c@x.co'); // failed one filtered out
    });
  });
});

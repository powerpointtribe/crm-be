import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Connection, Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { DonationsService } from '../giving/services/donations.service';
import { FlutterwaveClient } from '../giving/services/flutterwave.client';
import { GIVING_MODELS } from '../giving/giving.module';
import { EmailProvider } from '../notifications/providers/email.provider';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import {
  staffAuthHarness,
  TEST_JWT_SECRET,
} from '../test-utils/staff-auth-spec';
import { StorePermission } from './permissions';
import { Coupon, CouponSchema } from './schemas/coupon.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Product, ProductSchema } from './schemas/product.schema';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

type Json = Record<string, any>;

/** Poll until `ready()` is true (fire-and-forget side effects), or fail after 5 s. */
async function waitFor(ready: () => boolean, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (!ready()) {
    if (Date.now() > until) throw new Error('waitFor: timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const CONFIG: Record<string, string> = {
  JWT_SECRET: TEST_JWT_SECRET,
  FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-x',
  FLUTTERWAVE_HASH: 'hook-secret',
  FRONTEND_URL: 'https://crm.test',
  WEBSITE_URL: 'https://site.test/',
  GOOGLE_SHEET_WEBHOOK_URL: 'https://sheet.test/hook',
  GOOGLE_SHEET_SECRET: 's',
};

describe('Store additions for the website (integration)', () => {
  let db: { connection: Connection; close: () => Promise<void> };
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  const m: Record<string, Model<any>> = {};
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  let fetchMock: jest.SpyInstance;
  /** Requests sent to Flutterwave / the sheet, newest last. */
  let calls: { url: string; body?: Json }[];
  /** What Flutterwave's verify endpoints return, keyed by tx_ref. */
  let verified: Record<string, Json>;
  let productId: string;
  let anthony: Types.ObjectId;

  beforeAll(async () => {
    db = await openTestDb('store_website');
    const c = db.connection;
    m.Product = c.model(Product.name, ProductSchema);
    m.Order = c.model(Order.name, OrderSchema);
    m.Coupon = c.model(Coupon.name, CouponSchema);
    m.Branch = c.model(Branch.name, BranchSchema);
    for (const { name, schema } of GIVING_MODELS)
      m[name] = c.model(name, schema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [StoreController],
      providers: [
        StoreService,
        DonationsService,
        FlutterwaveClient,
        PermissionGuard,
        ...auth.providers.filter(
          (p) => (p as { provide?: unknown }).provide !== ConfigService,
        ),
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: unknown) => CONFIG[k] ?? d },
        },
        { provide: EmailProvider, useValue: { sendEmail } },
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

    const [a] = await m.Branch.create([
      { name: 'PPT Anthony', slug: 'ppt-anthony' },
      { name: 'Old campus', slug: 'old-campus', isActive: false },
    ]);
    anthony = a._id;
    const p = await m.Product.create({
      name: 'Tribe Tee',
      slug: 'tribe-tee',
      price: 5000,
      variants: [{ size: 'M', colour: 'Black', stock: 10 }],
      createdBy: new Types.ObjectId(),
    });
    productId = String(p._id);
  });

  /** Fake Flutterwave (+ sheet) responses. */
  const route = (url: string): Response => {
    if (url.endsWith('/payments')) {
      return Response.json({
        status: 'success',
        data: { link: 'https://checkout.flutterwave.test/pay/abc' },
      });
    }
    const ref = new URL(url).searchParams.get('tx_ref');
    if (ref) {
      return verified[ref]
        ? Response.json({ status: 'success', data: verified[ref] })
        : Response.json({
            status: 'error',
            message: 'No transaction was found',
          });
    }
    return new Response('ok');
  };

  beforeEach(() => {
    calls = [];
    verified = {};
    sendEmail.mockClear();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation((input: any, init?: any) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, body });
        return Promise.resolve(route(url));
      });
  });

  afterEach(() => fetchMock.mockRestore());

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());
  const delivery = {
    fullName: 'Ada Obi',
    phone: '08030000000',
    email: 'ada@example.com',
    address: '12 Allen Avenue',
    city: 'Ikeja',
  };
  const items = () => [
    { product: productId, size: 'M', colour: 'Black', quantity: 1 },
  ];

  describe('products', () => {
    it('category, byline and badge are optional, validated and public', async () => {
      const { token } = await staff([StorePermission.CREATE_PRODUCT]);
      const auth = { Authorization: `Bearer ${token}` };
      const base = {
        name: 'Book',
        price: 3000,
        variants: [{ size: 'One', colour: 'None', stock: 3 }],
      };
      await http()
        .post('/store/products')
        .set(auth)
        .send({ ...base, category: 'shoes' })
        .expect(400);
      await http()
        .post('/store/products')
        .set(auth)
        .send({ ...base, badge: 'hot' })
        .expect(400);
      await http()
        .post('/store/products')
        .set(auth)
        .send({ ...base, byline: 'x'.repeat(121) })
        .expect(400);
      const res = await http()
        .post('/store/products')
        .set(auth)
        .send({
          ...base,
          category: 'books',
          byline: 'by Dami Oguntunde',
          badge: 'new',
        })
        .expect(201);
      expect((res.body as Json).data).toMatchObject({
        category: 'books',
        byline: 'by Dami Oguntunde',
        badge: 'new',
      });

      const list = (await http().get('/store/public/products').expect(200))
        .body as Json;
      const tee = list.data.find((p: Json) => p.slug === 'tribe-tee');
      expect(tee.category).toBeNull(); // existing products default to no category
      expect(list.data.find((p: Json) => p.slug === 'book')).toMatchObject({
        category: 'books',
        badge: 'new',
      });
    });
  });

  describe('delivery orders (unchanged behaviour)', () => {
    it('still require delivery.address, with the same message', async () => {
      const noAddress = { ...delivery, address: undefined };
      const res = await http()
        .post('/store/public/orders')
        .send({ items: items(), delivery: noAddress })
        .expect(400);
      expect((res.body as Json).message).toContain(
        'delivery.address should not be empty',
      );
      await http()
        .post('/store/public/orders')
        .send({ items: items(), delivery: { ...noAddress, address: '   ' } })
        .expect(400);
      await http()
        .post('/store/public/orders')
        .send({
          items: items(),
          delivery: noAddress,
          fulfilment: { method: 'delivery' },
        })
        .expect(400);
    });

    it('a CRM order is a delivery order on the crm channel and returns to FRONTEND_URL exactly as before', async () => {
      const res = await http()
        .post('/store/public/orders')
        .send({ items: items(), delivery })
        .expect(201);
      const order = (res.body as Json).data;
      expect(order).toMatchObject({
        channel: 'crm',
        fulfilment: { method: 'delivery' },
      });
      await http().post(`/store/public/orders/${order._id}/pay`).expect(201);
      expect(calls.at(-1)!.body!.redirect_url).toBe(
        `https://crm.test/store/payment/verify?order=${order.orderNumber}&product=tribe-tee`,
      );
    });
  });

  describe('website orders', () => {
    it('return to WEBSITE_URL/shop/order', async () => {
      const res = await http()
        .post('/store/public/orders')
        .send({ items: items(), delivery, channel: 'website' })
        .expect(201);
      const order = (res.body as Json).data;
      await http().post(`/store/public/orders/${order._id}/pay`).expect(201);
      expect(calls.at(-1)!.body!.redirect_url).toBe(
        `https://site.test/shop/order?order=${order.orderNumber}`,
      );
    });

    it('reject an unknown channel', async () => {
      await http()
        .post('/store/public/orders')
        .send({ items: items(), delivery, channel: 'app' })
        .expect(400);
    });
  });

  describe('pickup orders', () => {
    const pickupDelivery = {
      fullName: 'Ada Obi',
      phone: '08030000000',
      email: 'ada@example.com',
    };

    it('need no address, and need an active campus (slug or id)', async () => {
      await http()
        .post('/store/public/orders')
        .send({
          items: items(),
          delivery: pickupDelivery,
          fulfilment: { method: 'pickup' },
        })
        .expect(400);
      for (const branch of [
        'old-campus',
        'nowhere',
        String(new Types.ObjectId()),
      ]) {
        const res = await http()
          .post('/store/public/orders')
          .send({
            items: items(),
            delivery: pickupDelivery,
            fulfilment: { method: 'pickup', branch },
          })
          .expect(400);
        expect((res.body as Json).message).toBe(
          'fulfilment.branch must be an active campus',
        );
      }
      const bySlug = (
        await http()
          .post('/store/public/orders')
          .send({
            items: items(),
            delivery: pickupDelivery,
            fulfilment: { method: 'pickup', branch: 'ppt-anthony' },
          })
          .expect(201)
      ).body as Json;
      expect(bySlug.data.fulfilment).toEqual({
        method: 'pickup',
        branch: String(anthony),
        branchName: 'PPT Anthony',
      });
      await http()
        .post('/store/public/orders')
        .send({
          items: items(),
          delivery: pickupDelivery,
          fulfilment: { method: 'pickup', branch: String(anthony) },
        })
        .expect(201);
    });

    it('confirmation email and order sheet show the pickup campus (no crash without an address)', async () => {
      const order = (
        (
          await http()
            .post('/store/public/orders')
            .send({
              items: items(),
              delivery: pickupDelivery,
              channel: 'website',
              fulfilment: { method: 'pickup', branch: 'ppt-anthony' },
            })
            .expect(201)
        ).body as Json
      ).data;
      await http().post(`/store/public/orders/${order._id}/pay`).expect(201);
      const txRef = calls.at(-1)!.body!.tx_ref as string;
      await http()
        .post('/store/webhook/flutterwave')
        .set('verif-hash', 'hook-secret')
        .send({
          event: 'charge.completed',
          data: { status: 'successful', tx_ref: txRef, id: 77 },
        })
        .expect(200);
      // Email and sheet push are fire-and-forget: wait for them (max 5 s).
      await waitFor(
        () =>
          sendEmail.mock.calls.length > 0 &&
          calls.some((c) => c.url === 'https://sheet.test/hook'),
      );
      expect(await m.Order.findById(order._id).lean()).toMatchObject({
        status: 'paid',
        paymentStatus: 'successful',
      });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const html = sendEmail.mock.calls[0][0].html as string;
      expect(html).toContain('Pickup at PPT Anthony');
      expect(html).toContain('>Pickup</p>');
      const sheet = calls.find((c) => c.url === 'https://sheet.test/hook');
      expect(sheet!.body!.order.address).toBe('Pickup: PPT Anthony');
    });
  });

  describe('shared Flutterwave webhook', () => {
    it('rejects a bad verif-hash before dispatching anything', async () => {
      const res = await http()
        .post('/store/webhook/flutterwave')
        .set('verif-hash', 'wrong')
        .send({
          event: 'charge.completed',
          data: { status: 'successful', tx_ref: `PPTG-${'a'.repeat(24)}` },
        })
        .expect(200);
      expect(res.body).toEqual({ status: 'error' });
      expect(calls).toHaveLength(0);
    });

    it('hands PPTG- references to giving, which re-verifies with Flutterwave', async () => {
      const reference = `PPTG-${new Types.ObjectId().toHexString()}`;
      await m.Donation.create({
        reference,
        fund: 'tithe',
        amount: 5000,
        branch: anthony,
        donor: { email: 'g@example.com' },
      });
      verified[reference] = {
        id: 9,
        tx_ref: reference,
        status: 'successful',
        amount: 5000,
        currency: 'NGN',
      };
      const res = await http()
        .post('/store/webhook/flutterwave')
        .set('verif-hash', 'hook-secret')
        // Payload amount is ignored: the verify API is the source of truth.
        .send({
          event: 'charge.completed',
          data: { status: 'successful', tx_ref: reference, amount: 1 },
        })
        .expect(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(
        calls.some((c) =>
          c.url.includes(`verify_by_reference?tx_ref=${reference}`),
        ),
      ).toBe(true);
      expect(await m.Donation.findOne({ reference }).lean()).toMatchObject({
        status: 'successful',
        receiptNo: expect.stringMatching(/^PPT-\d{4}-000001$/),
      });
      // Nothing touched the store.
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('store references still go through the store path', async () => {
      const order = (
        (
          await http()
            .post('/store/public/orders')
            .send({ items: items(), delivery })
            .expect(201)
        ).body as Json
      ).data;
      await http().post(`/store/public/orders/${order._id}/pay`).expect(201);
      const txRef = calls.at(-1)!.body!.tx_ref as string;
      expect(txRef.startsWith('store-')).toBe(true);
      calls = [];
      await http()
        .post('/store/webhook/flutterwave')
        .set('verif-hash', 'hook-secret')
        .send({
          event: 'charge.completed',
          data: { status: 'successful', tx_ref: txRef, id: 5 },
        })
        .expect(200);
      expect(await m.Order.findById(order._id).lean()).toMatchObject({
        paymentStatus: 'successful',
        flutterwaveTransactionId: '5',
      });
      expect(calls.some((c) => c.url.includes('verify_by_reference'))).toBe(
        false,
      );
    });
  });
});

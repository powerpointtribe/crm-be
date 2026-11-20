import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Connection, Model, Types } from 'mongoose';
import * as request from 'supertest';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { EmailTemplateResolverService } from '../bulk-email/email-template-resolver.service';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../bulk-email/schemas/email-template.schema';
import { FirstTimersService } from '../first-timers/first-timers.service';
import {
  FirstTimer,
  FirstTimerSchema,
} from '../first-timers/schemas/first-timer.schema';
import { EmailProvider } from '../notifications/providers/email.provider';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { WebsiteFormsController } from './controllers/website-forms.controller';
import { WebsiteInboxController } from './controllers/website-inbox.controller';
import { WebsitePermission as P } from './permissions';
import {
  WebFormSubmission,
  WebFormSubmissionSchema,
  WebSubscription,
  WebSubscriptionSchema,
} from './schemas/web-form-submission.schema';
import { WebsiteFormsService } from './services/website-forms.service';
import { WebsiteInboxService } from './services/website-inbox.service';
import { lagosDate } from './utils/lagos-date.util';

type Json = Record<string, any>;

describe('Website forms + inbox (integration)', () => {
  let db: { connection: Connection; close: () => Promise<void> };
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];
  let subs: Model<WebFormSubmission>;
  let signups: Model<WebSubscription>;
  let firstTimers: Model<FirstTimer>;
  let anthonyId: Types.ObjectId;
  const sendEmail = jest.fn();
  let ip = 0;

  beforeAll(async () => {
    db = await openTestDb('website_forms');
    const c = db.connection;
    subs = c.model(WebFormSubmission.name, WebFormSubmissionSchema);
    signups = c.model(WebSubscription.name, WebSubscriptionSchema);
    firstTimers = c.model(FirstTimer.name, FirstTimerSchema);
    const branches = c.model(Branch.name, BranchSchema);
    const templates = c.model(EmailTemplate.name, EmailTemplateSchema);
    const auth = staffAuthHarness(c);
    staff = auth.staff;

    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        // Same global throttler as AppModule.
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      ],
      controllers: [WebsiteFormsController, WebsiteInboxController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        WebsiteFormsService,
        WebsiteInboxService,
        FirstTimersService,
        EmailTemplateResolverService,
        PermissionGuard,
        ...auth.providers,
        { provide: EmailProvider, useValue: { sendEmail } },
        { provide: getModelToken(WebFormSubmission.name), useValue: subs },
        { provide: getModelToken(WebSubscription.name), useValue: signups },
        { provide: getModelToken(FirstTimer.name), useValue: firstTimers },
        { provide: getModelToken(Branch.name), useValue: branches },
        { provide: getModelToken(EmailTemplate.name), useValue: templates },
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();

    const [anthony] = await branches.create([
      {
        name: 'PPT Anthony',
        slug: 'ppt-anthony',
        address: { street: '1 Church Rd', city: 'Lagos' },
      },
      { name: 'Closed', slug: 'closed', isActive: false },
    ]);
    anthonyId = anthony._id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined);
  });

  /** A fresh client IP per request, so the 5/min form limit doesn't interfere. */
  const post = (path: string, body: Json, fixedIp?: string) =>
    request(app.getHttpServer())
      .post(`/website/public/${path}`)
      .set(
        'X-Forwarded-For',
        fixedIp ?? `10.1.${Math.floor(++ip / 250)}.${ip % 250}`,
      )
      .send(body);

  const visit = {
    firstName: 'Ada',
    lastName: 'Obi',
    phone: '0803 000 0001',
    email: 'Ada@Example.com',
    branch: 'ppt-anthony',
    visitDate: lagosDate(7),
    note: 'Coming with my sister',
    source: { page: '/visit', utm: { source: 'instagram' } },
  };

  describe('plan a visit', () => {
    it('stores the submission, creates a first-timer for the planned date, emails a confirmation', async () => {
      const res = await post('forms/visit', visit).expect(201);
      expect(res.body).toMatchObject({
        success: true,
        data: { status: 'received' },
      });

      const sub = await subs
        .findOne({ formType: 'visit', 'contact.phone': '08030000001' })
        .lean();
      expect(sub).toMatchObject({
        status: 'new',
        contact: {
          name: 'Ada Obi',
          email: 'ada@example.com',
          phone: '08030000001',
        },
        payload: { visitDate: visit.visitDate, note: 'Coming with my sister' },
        consent: { version: '2026-11-20' },
        source: { page: '/visit', utm: { source: 'instagram' } },
      });
      expect(String(sub!.branch)).toBe(String(anthonyId));

      const ft = await firstTimers.findById(sub!.firstTimer).lean();
      expect(ft).toMatchObject({
        firstName: 'Ada',
        phone: '08030000001',
        email: 'ada@example.com',
        howDidYouHear: 'website',
        visitorType: 'first_time',
        status: 'NEW', // CRM EngagementStatus value
      });
      expect(String(ft!.branch)).toBe(String(anthonyId));
      // Lagos midnight on the planned date, not "today".
      expect(new Date(ft!.dateOfVisit).toISOString()).toBe(
        new Date(`${visit.visitDate}T00:00:00+01:00`).toISOString(),
      );
      expect(ft!.notes).toContain(
        `Planned visit via the website for ${visit.visitDate}`,
      );

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const mail = sendEmail.mock.calls[0][0] as {
        to: string;
        subject: string;
        html: string;
      };
      expect(mail.to).toBe('ada@example.com');
      expect(mail.subject).toBe('See you at PPT Anthony!');
      expect(mail.html).toContain('1 Church Rd, Lagos');
    });

    it('links an existing first-timer instead of duplicating (case-insensitive name)', async () => {
      const before = await firstTimers.countDocuments();
      await post('forms/visit', { ...visit, firstName: 'ADA' }).expect(201);
      expect(await firstTimers.countDocuments()).toBe(before);
      const latest = await subs
        .findOne({ formType: 'visit' })
        .sort({ createdAt: -1 })
        .lean();
      const ft = await firstTimers.findOne({ phone: '08030000001' }).lean();
      expect(String(latest!.firstTimer)).toBe(String(ft!._id));
    });

    it('works without an email (no confirmation sent)', async () => {
      await post('forms/visit', {
        ...visit,
        phone: '+2348030000002',
        email: '',
      }).expect(201);
      expect(sendEmail).not.toHaveBeenCalled();
      const ft = await firstTimers.findOne({ phone: '+2348030000002' }).lean();
      expect(ft).not.toBeNull();
    });

    it('escapes HTML in the email and treats regex characters in names literally', async () => {
      await post('forms/visit', {
        ...visit,
        firstName: '<b>(a+)+$</b>',
        phone: '08030000003',
        email: 'x@example.com',
      }).expect(201);
      const html = (sendEmail.mock.calls[0][0] as { html: string }).html;
      expect(html).toContain('&lt;b&gt;(a+)+$&lt;/b&gt;');
      expect(html).not.toContain('<b>(a+)');
    });

    it('still succeeds (and keeps the visit) when the email provider fails', async () => {
      sendEmail.mockRejectedValueOnce(new Error('SMTP down'));
      await post('forms/visit', {
        ...visit,
        phone: '08030000004',
        email: 'y@example.com',
      }).expect(201);
      expect(
        await subs.countDocuments({ 'contact.phone': '08030000004' }),
      ).toBe(1);
    });

    it.each([
      ['no phone', { phone: undefined }],
      ['a bad phone', { phone: '12' }],
      ['a bad email', { email: 'nope' }],
      ['yesterday', { visitDate: lagosDate(-1) }],
      ['more than 120 days ahead', { visitDate: lagosDate(121) }],
      ['an impossible date', { visitDate: '2027-02-30' }],
      ['no first name', { firstName: '  ' }],
      ['a long note', { note: 'x'.repeat(501) }],
      ['a bad source page', { source: { page: 'https://evil' } }],
    ])('400 for %s', async (_label, over) => {
      const before = await subs.countDocuments();
      await post('forms/visit', { ...visit, ...over }).expect(400);
      expect(await subs.countDocuments()).toBe(before);
    });

    it('400 "Choose a campus." for unknown or inactive campuses', async () => {
      const res = await post('forms/visit', {
        ...visit,
        branch: 'nowhere',
      }).expect(400);
      expect((res.body as Json).message).toBe('Choose a campus.');
      await post('forms/visit', { ...visit, branch: 'closed' }).expect(400);
    });

    it('honeypot: same 201, nothing stored, no email', async () => {
      const before = await subs.countDocuments();
      const ftBefore = await firstTimers.countDocuments();
      await post('forms/visit', {
        ...visit,
        phone: '08039999999',
        website: 'http://spam',
      }).expect(201);
      expect(await subs.countDocuments()).toBe(before);
      expect(await firstTimers.countDocuments()).toBe(ftBefore);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('5 form posts per minute per IP, then 429 (other IPs unaffected)', async () => {
      for (let i = 0; i < 5; i++) {
        await post(
          'forms/event-notify',
          { email: `t${i}@example.com` },
          '10.200.0.1',
        ).expect(201);
      }
      await post(
        'forms/event-notify',
        { email: 't6@example.com' },
        '10.200.0.1',
      ).expect(429);
      await post(
        'forms/event-notify',
        { email: 't7@example.com' },
        '10.200.0.2',
      ).expect(201);
    });
  });

  describe('other forms', () => {
    it('partner', async () => {
      await post('forms/partner', {
        firstName: 'P',
        lastName: 'Q',
        phone: '08031111111',
        email: 'p@q.co',
        branch: 'ppt-anthony',
        monthlyAmount: 5000,
        method: 'transfer',
      }).expect(201);
      const s = await subs.findOne({ formType: 'partner' }).lean();
      expect(s!.payload).toEqual({
        monthlyAmount: 5000,
        currency: 'NGN',
        method: 'transfer',
      });
      await post('forms/partner', {
        firstName: 'P',
        lastName: 'Q',
        phone: '08031111111',
        email: 'p@q.co',
        branch: 'ppt-anthony',
        monthlyAmount: 50,
        method: 'transfer',
      }).expect(400);
    });

    it('care drop-off (kinds must be a non-empty set of known kinds)', async () => {
      const body = {
        name: 'C',
        phone: '08032222222',
        kinds: ['clothes', 'shoes'],
        branch: 'ppt-anthony',
        dropoffDate: lagosDate(3),
      };
      await post('forms/care-dropoff', body).expect(201);
      await post('forms/care-dropoff', { ...body, kinds: [] }).expect(400);
      await post('forms/care-dropoff', {
        ...body,
        kinds: ['clothes', 'clothes'],
      }).expect(400);
      await post('forms/care-dropoff', {
        ...body,
        kinds: ['furniture'],
      }).expect(400);
      await post('forms/care-dropoff', {
        ...body,
        dropoffDate: lagosDate(61),
      }).expect(400);
    });

    it("David's Company interest and event notify", async () => {
      await post('forms/dc-interest', {
        firstName: 'D',
        lastName: 'C',
        phone: '08033333333',
        branch: 'ppt-anthony',
        unit: 'Waves',
      }).expect(201);
      await post('forms/event-notify', {
        email: 'E@x.co',
        event: 'sozo',
      }).expect(201);
      expect(
        await subs.findOne({ formType: 'dc_interest' }).lean(),
      ).toMatchObject({ payload: { unit: 'Waves' } });
      expect(
        await subs
          .findOne({ formType: 'event_notify', 'contact.email': 'e@x.co' })
          .lean(),
      ).toMatchObject({ payload: { event: 'sozo' } });
    });

    it('sign-ups: email or WhatsApp, de-duplicated', async () => {
      await post('subscriptions', {
        list: 'merch_drop',
        contact: ' Fan@Example.com ',
      }).expect(201);
      await post('subscriptions', {
        list: 'merch_drop',
        contact: 'fan@example.com',
      }).expect(201);
      await post('subscriptions', {
        list: 'merch_drop',
        contact: '+234 803 444 4444',
      }).expect(201);
      expect(await signups.countDocuments({ list: 'merch_drop' })).toBe(2);
      expect(
        await signups.findOne({ channel: 'whatsapp' }).lean(),
      ).toMatchObject({ address: '+2348034444444' });
      await post('subscriptions', {
        list: 'merch_drop',
        contact: 'not a contact',
      }).expect(400);
      await post('subscriptions', { list: 'gossip', contact: 'a@b.co' }).expect(
        400,
      );
    });
  });

  describe('staff inbox', () => {
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
    const http = () => request(app.getHttpServer());

    it('401 without a token, 403 without the permission', async () => {
      await http().get('/website/submissions').expect(401);
      const other = await staff([P.VIEW_CONTENT]);
      await http()
        .get('/website/submissions')
        .set(bearer(other.token))
        .expect(403);
    });

    it('lists with filters and search, and summarises', async () => {
      const { token } = await staff([P.VIEW_SUBMISSIONS]);
      const visits = (
        await http()
          .get('/website/submissions?formType=visit&limit=50')
          .set(bearer(token))
          .expect(200)
      ).body as Json;
      expect(visits.data.total).toBeGreaterThanOrEqual(5);
      expect(visits.data.data[0]).toHaveProperty('contact');
      expect(visits.data.data[0].branch).toMatchObject({ name: 'PPT Anthony' });
      const found = (
        await http()
          .get('/website/submissions?search=0803222')
          .set(bearer(token))
      ).body as Json;
      expect(found.data.data.map((s: Json) => s.formType)).toEqual([
        'care_dropoff',
      ]);
      const summary = (
        await http().get('/website/submissions/summary').set(bearer(token))
      ).body as Json;
      expect(summary.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ formType: 'visit', status: 'new' }),
        ]),
      );
    });

    it('updates status, notes and assignee; manage permission needed', async () => {
      const viewer = await staff([P.VIEW_SUBMISSIONS]);
      const manager = await staff([P.MANAGE_SUBMISSIONS, P.VIEW_SUBMISSIONS]);
      const s = await subs.findOne({ formType: 'partner' }).lean();
      const url = `/website/submissions/${String(s!._id)}`;
      await http()
        .patch(url)
        .set(bearer(viewer.token))
        .send({ status: 'done' })
        .expect(403);
      await http()
        .patch(url)
        .set(bearer(manager.token))
        .send({ status: 'archived' })
        .expect(400);
      const res = (
        await http()
          .patch(url)
          .set(bearer(manager.token))
          .send({
            status: 'in_progress',
            notes: ' Called ',
            assignedTo: String(manager.id),
          })
          .expect(200)
      ).body as Json;
      expect(res.data).toMatchObject({
        status: 'in_progress',
        notes: 'Called',
      });
      expect(String(res.data.assignedTo)).toBe(String(manager.id));
      await http()
        .patch(url)
        .set(bearer(manager.token))
        .send({ assignedTo: null })
        .expect(200);
      await http()
        .get('/website/submissions/not-an-id')
        .set(bearer(manager.token))
        .expect(404);
      await http().delete(url).set(bearer(manager.token)).expect(200);
      await http().get(url).set(bearer(manager.token)).expect(404);
    });

    it('sign-ups list and CSV export (spreadsheet formulas neutralised)', async () => {
      await post('subscriptions', {
        list: 'newsletter',
        contact: '=HYPERLINK@evil.com',
      }).expect(201);
      const { token } = await staff([P.EXPORT_SUBSCRIPTIONS]);
      const list = (
        await http()
          .get('/website/subscriptions?list=newsletter')
          .set(bearer(token))
          .expect(200)
      ).body as Json;
      expect(list.data.total).toBe(1);
      const csv = await http()
        .get('/website/subscriptions/export?list=newsletter')
        .set(bearer(token))
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toContain('subscriptions.csv');
      expect(csv.text).toContain(`"'=hyperlink@evil.com"`);
      const viewer = await staff([P.VIEW_SUBMISSIONS]);
      await http()
        .get('/website/subscriptions/export')
        .set(bearer(viewer.token))
        .expect(403);
    });
  });
});

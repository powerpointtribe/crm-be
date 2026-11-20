import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { QaPost, QaPostSchema } from '../lms/schemas/qa-post.schema';
import { LmsService } from '../lms/lms.service';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import {
  EventPartner,
  EventPartnerSchema,
} from './schemas/event-partner.schema';
import { Event, EventSchema, EventStatus } from './schemas/event.schema';
import { Feedback, FeedbackSchema } from './schemas/feedback.schema';
import { Testimony, TestimonySchema } from './schemas/testimony.schema';

describe('Public event routes hide draft events (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let events: Model<Event>;
  let lms: LmsService;

  const base = {
    startDate: new Date('2030-01-10'),
    endDate: new Date('2030-01-11'),
    testimonyFormEnabled: true,
    feedbackFormEnabled: true,
  };

  beforeAll(async () => {
    db = await openTestDb('events_public');
    const c = db.connection;
    const models: Record<string, Model<any>> = {
      [Event.name]: c.model(Event.name, EventSchema),
      [EventPartner.name]: c.model(EventPartner.name, EventPartnerSchema),
      [Testimony.name]: c.model(Testimony.name, TestimonySchema),
      [Feedback.name]: c.model(Feedback.name, FeedbackSchema),
      [QaPost.name]: c.model(QaPost.name, QaPostSchema),
      // Registered so populate('branch' | 'organizer') works.
      [Branch.name]: c.model(Branch.name, BranchSchema),
      [Member.name]: c.model(Member.name, MemberSchema),
    };
    events = models[Event.name] as Model<Event>;

    await db.ready();

    const moduleRef = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        EventsService,
        LmsService,
        ...Object.entries(models).map(([name, model]) => ({
          provide: getModelToken(name),
          useValue: model,
        })),
      ],
    })
      .useMocker(autoMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    lms = moduleRef.get(LmsService);

    await events.create([
      {
        ...base,
        title: 'Draft',
        registrationSlug: 'draft-ev',
        status: EventStatus.DRAFT,
      },
      {
        ...base,
        title: 'Live',
        registrationSlug: 'live-ev',
        status: EventStatus.PUBLISHED,
      },
      {
        ...base,
        title: 'Off',
        registrationSlug: 'off-ev',
        status: EventStatus.CANCELLED,
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const http = () => request(app.getHttpServer());

  describe('GET /events/public/:slug', () => {
    it('404 for a draft event (it used to be returned)', async () => {
      const res = await http().get('/events/public/draft-ev').expect(404);
      expect(JSON.stringify(res.body)).not.toContain('Draft');
    });

    it('a draft looks exactly like an unknown slug', async () => {
      const draft = await http().get('/events/public/draft-ev');
      const unknown = await http().get('/events/public/nope');
      expect(draft.status).toBe(unknown.status);
      expect((draft.body as { message: string }).message).toBe(
        'Event with slug "draft-ev" not found',
      );
    });

    it('still returns published and cancelled events', async () => {
      const live = await http().get('/events/public/live-ev').expect(200);
      expect((live.body as { title: string }).title).toBe('Live');
      const off = await http().get('/events/public/off-ev').expect(200);
      expect((off.body as { status: string }).status).toBe('cancelled');
    });
  });

  it('POST /events/public/:slug/register: 404 for a draft', async () => {
    await http()
      .post('/events/public/draft-ev/register')
      .send({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
        phone: '08030000000',
      })
      .expect(404);
  });

  it('POST /events/public/:slug/partner: 404 for a draft', async () => {
    await http()
      .post('/events/public/draft-ev/partner')
      .send({ name: 'A', email: 'a@b.co', phone: '0803', interestDetails: 'x' })
      .expect(404);
    expect(await db.connection.model(EventPartner.name).countDocuments()).toBe(
      0,
    );
  });

  describe('testimony and feedback forms', () => {
    it('hide a draft event even when the form is enabled', async () => {
      await http().get('/events/public/draft-ev/testimony-form').expect(404);
      await http().get('/events/public/draft-ev/feedback-form').expect(404);
      await http()
        .post('/events/public/draft-ev/testimonies')
        .send({ fullName: 'A', testimony: 'x' })
        .expect(404);
      await http()
        .post('/events/public/draft-ev/feedbacks')
        .send({ fullName: 'A', message: 'x' })
        .expect(404);
      const c = db.connection;
      expect(await c.model(Testimony.name).countDocuments()).toBe(0);
      expect(await c.model(Feedback.name).countDocuments()).toBe(0);
    });

    it('still work for a published event', async () => {
      await http().get('/events/public/live-ev/testimony-form').expect(200);
      await http().get('/events/public/live-ev/feedback-form').expect(200);
      await http()
        .post('/events/public/live-ev/testimonies')
        .send({ fullName: 'A', testimony: 'Thank you' })
        .expect(201);
      await http()
        .post('/events/public/live-ev/feedbacks')
        .send({ fullName: 'A', message: 'Great' })
        .expect(201);
    });
  });

  it('public Q&A feed is empty for a draft event, as for an unknown one', async () => {
    const draft = await events.findOne({ registrationSlug: 'draft-ev' });
    const live = await events.findOne({ registrationSlug: 'live-ev' });
    const posts = db.connection.model(QaPost.name);
    await posts.create([
      { event: draft!._id, question: 'secret?', answerText: 'yes' },
      { event: live!._id, question: 'open?', answerText: 'yes' },
    ]);
    expect((await lms.getPublicQaFeed('draft-ev')).items).toHaveLength(0);
    expect((await lms.getPublicQaFeed('live-ev')).items).toHaveLength(1);
  });
});

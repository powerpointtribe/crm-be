import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { Event, EventSchema } from '../events/schemas/event.schema';
import {
  GivingAccount,
  GivingAccountSchema,
} from '../giving/schemas/giving.schemas';
import {
  LostItemClaim,
  LostItemClaimSchema,
} from '../lost-found/schemas/lost-item-claim.schema';
import {
  LostItem,
  LostItemSchema,
} from '../lost-found/schemas/lost-item.schema';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { Order, OrderSchema } from '../store/schemas/order.schema';
import { configureLikeMain } from '../test-utils/app-spec';
import { autoMock } from '../test-utils/auto-mock-spec';
import { openTestDb } from '../test-utils/mongo-spec';
import { staffAuthHarness } from '../test-utils/staff-auth-spec';
import { WebsiteInboxController } from './controllers/website-inbox.controller';
import {
  WebFormSubmission,
  WebFormSubmissionSchema,
} from './schemas/web-form-submission.schema';
import { WebSermon, WebSermonSchema } from './schemas/web-sermon.schema';
import { WebsiteAccessService } from './services/website-access.service';
import { WebsiteInboxService } from './services/website-inbox.service';
import { WebsiteSummaryService } from './services/website-summary.service';

type Json = Record<string, any>;

describe('GET /website/summary (integration)', () => {
  let db: Awaited<ReturnType<typeof openTestDb>>;
  let app: INestApplication;
  let staff: ReturnType<typeof staffAuthHarness>['staff'];

  beforeAll(async () => {
    db = await openTestDb('website_summary');
    const c = db.connection;
    const models: Record<string, Model<any>> = {
      [WebFormSubmission.name]: c.model(
        WebFormSubmission.name,
        WebFormSubmissionSchema,
      ),
      [WebSermon.name]: c.model(WebSermon.name, WebSermonSchema),
      [Event.name]: c.model(Event.name, EventSchema),
      [LostItem.name]: c.model(LostItem.name, LostItemSchema),
      [LostItemClaim.name]: c.model(LostItemClaim.name, LostItemClaimSchema),
      [GivingAccount.name]: c.model(GivingAccount.name, GivingAccountSchema),
      [Order.name]: c.model(Order.name, OrderSchema),
    };
    const auth = staffAuthHarness(c);
    staff = auth.staff;
    await db.ready();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [WebsiteInboxController],
      providers: [
        WebsiteInboxService,
        WebsiteSummaryService,
        WebsiteAccessService,
        PermissionGuard,
        ...auth.providers,
        ...Object.entries(models).map(([name, model]) => ({
          provide: getModelToken(name),
          useValue: model,
        })),
      ],
    })
      .useMocker(autoMock)
      .compile();
    app = configureLikeMain(moduleRef.createNestApplication());
    await app.init();

    // Fixtures go in raw, bypassing schema validation; only the counted fields matter.
    const raw = (name: string, docs: Json[]) =>
      models[name].collection.insertMany(docs);
    await raw(WebFormSubmission.name, [
      { status: 'new' },
      { status: 'new' },
      { status: 'done' },
    ]);
    await raw(WebSermon.name, [
      { slug: 'a', status: 'draft' },
      { slug: 'b', status: 'published' },
    ]);
    await raw(Event.name, [
      {
        status: 'published',
        website: { showOnWebsite: true },
        endDate: new Date(Date.now() + 864e5),
      },
      {
        status: 'published',
        website: { showOnWebsite: true },
        endDate: new Date(Date.now() - 864e5),
      },
      { status: 'published', endDate: new Date(Date.now() + 864e5) },
    ]);
    await raw(LostItem.name, [
      { status: 'pending_review' },
      { status: 'listed' },
    ]);
    await raw(LostItemClaim.name, [
      { status: 'pending' },
      { status: 'approved' },
    ]);
    await raw(GivingAccount.name, [
      { approvalStatus: 'draft', pendingChange: null },
      { approvalStatus: 'approved', pendingChange: { fields: { bank: 'X' } } },
      { approvalStatus: 'approved', pendingChange: null },
    ]);
    await raw(Order.name, [
      // orderNumber is unique: give each fixture one.
      { orderNumber: 'ORD-T-1', status: 'paid' },
      { orderNumber: 'ORD-T-2', status: 'processing' },
      { orderNumber: 'ORD-T-3', status: 'delivered' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  const get = (token?: string) => {
    const r = request(app.getHttpServer()).get('/website/summary');
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  it('401 without a token, 403 with none of the permissions', async () => {
    await get().expect(401);
    const { token } = await staff(['members:view']);
    await get(token).expect(403);
  });

  it('returns only the counters the caller may see', async () => {
    const { token } = await staff([
      'website:view-submissions',
      'lost-found:view-claims',
    ]);
    const res = (await get(token).expect(200)).body as Json;
    expect(res.data).toEqual({ newSubmissions: 2, claimsPending: 1 });
  });

  it('every counter, for someone with all the permissions', async () => {
    const { token } = await staff([
      'website:view-submissions',
      'website:view-content',
      'events:view',
      'lost-found:view',
      'lost-found:view-claims',
      'giving:approve-accounts',
      'store:view-orders',
    ]);
    const res = (await get(token).expect(200)).body as Json;
    expect(res.data).toEqual({
      newSubmissions: 2,
      draftSermons: 1,
      upcomingEvents: 1,
      lostItemsToReview: 1,
      claimsPending: 1,
      accountsAwaitingApproval: 2,
      ordersToFulfil: 2,
    });
  });
});

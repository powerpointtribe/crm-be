import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventsPermission } from '../../events/permissions';
import {
  Event,
  EventDocument,
  EventStatus,
} from '../../events/schemas/event.schema';
import { GivingPermission } from '../../giving/permissions';
import {
  AccountApprovalStatus,
  GivingAccount,
} from '../../giving/schemas/giving.schemas';
import { LostFoundPermission } from '../../lost-found/permissions';
import {
  ClaimStatus,
  LostItemClaim,
} from '../../lost-found/schemas/lost-item-claim.schema';
import {
  LostItem,
  LostItemStatus,
} from '../../lost-found/schemas/lost-item.schema';
import { StorePermission } from '../../store/permissions';
import { Order, OrderStatus } from '../../store/schemas/order.schema';
import { WebsitePermission } from '../permissions';
import { PublishStatus } from '../schemas/publishing';
import {
  SubmissionStatus,
  WebFormSubmission,
} from '../schemas/web-form-submission.schema';
import { WebSermon } from '../schemas/web-sermon.schema';
import { WebsiteAccessService } from './website-access.service';

type Counter = { permission: string; count: () => Promise<number> };

/** Dashboard counters for the website admin, filtered by what the caller may see. */
@Injectable()
export class WebsiteSummaryService {
  constructor(
    private readonly access: WebsiteAccessService,
    @InjectModel(WebFormSubmission.name)
    private readonly submissions: Model<WebFormSubmission>,
    @InjectModel(WebSermon.name) private readonly sermons: Model<WebSermon>,
    @InjectModel(Event.name) private readonly events: Model<EventDocument>,
    @InjectModel(LostItem.name) private readonly lostItems: Model<LostItem>,
    @InjectModel(LostItemClaim.name)
    private readonly claims: Model<LostItemClaim>,
    @InjectModel(GivingAccount.name)
    private readonly accounts: Model<GivingAccount>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
  ) {}

  private counters(now: Date): Record<string, Counter> {
    return {
      newSubmissions: {
        permission: WebsitePermission.VIEW_SUBMISSIONS,
        count: () =>
          this.submissions
            .countDocuments({ status: SubmissionStatus.NEW })
            .exec(),
      },
      draftSermons: {
        permission: WebsitePermission.VIEW_CONTENT,
        count: () =>
          this.sermons.countDocuments({ status: PublishStatus.DRAFT }).exec(),
      },
      upcomingEvents: {
        permission: EventsPermission.VIEW_EVENTS,
        count: () =>
          this.events
            .countDocuments({
              status: EventStatus.PUBLISHED,
              'website.showOnWebsite': true,
              endDate: { $gte: now },
            })
            .exec(),
      },
      lostItemsToReview: {
        permission: LostFoundPermission.VIEW_ITEMS,
        count: () =>
          this.lostItems
            .countDocuments({ status: LostItemStatus.PENDING_REVIEW })
            .exec(),
      },
      claimsPending: {
        permission: LostFoundPermission.VIEW_CLAIMS,
        count: () =>
          this.claims.countDocuments({ status: ClaimStatus.PENDING }).exec(),
      },
      accountsAwaitingApproval: {
        permission: GivingPermission.APPROVE_ACCOUNTS,
        count: () =>
          this.accounts
            .countDocuments({
              $or: [
                { approvalStatus: AccountApprovalStatus.DRAFT },
                { pendingChange: { $ne: null } },
              ],
            })
            .exec(),
      },
      ordersToFulfil: {
        permission: StorePermission.VIEW_ORDERS,
        count: () =>
          this.orders
            .countDocuments({
              status: { $in: [OrderStatus.PAID, OrderStatus.PROCESSING] },
            })
            .exec(),
      },
    };
  }

  async summary(
    user: Parameters<WebsiteAccessService['permissionsOf']>[0],
    now = new Date(),
  ) {
    const perms = await this.access.permissionsOf(user);
    const visible = Object.entries(this.counters(now)).filter(([, c]) =>
      perms.has(c.permission),
    );
    const counts = await Promise.all(visible.map(([, c]) => c.count()));
    return Object.fromEntries(visible.map(([key], i) => [key, counts[i]]));
  }
}

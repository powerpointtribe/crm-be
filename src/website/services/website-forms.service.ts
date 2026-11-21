import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';
import { EmailTemplateResolverService } from '../../bulk-email/email-template-resolver.service';
import { PublicCreateFirstTimerDto } from '../../first-timers/dto/public-first-timer.dto';
import { FirstTimersService } from '../../first-timers/first-timers.service';
import {
  FirstTimer,
  FirstTimerDocument,
} from '../../first-timers/schemas/first-timer.schema';
import { EmailProvider } from '../../notifications/providers/email.provider';
import {
  CareDropoffFormDto,
  DcInterestFormDto,
  EventNotifyFormDto,
  PartnerFormDto,
  SubscribeDto,
  VisitFormDto,
} from '../dto/forms.dto';
import {
  SubscriptionChannel,
  WebFormSubmission,
  WebFormSubmissionDocument,
  WebFormType,
  WebSubscription,
  WebSubscriptionDocument,
} from '../schemas/web-form-submission.schema';
import {
  escapeHtml,
  formatLagosDate,
  lagosMidnight,
} from '../utils/lagos-date.util';
import { escapeRegex } from '../utils/text.util';

export const CONSENT_VERSION = '2026-11-20';

/** Shown under each form on the website (the frontend shows the same words). */
export const CONSENT: Record<string, string> = {
  visit:
    "We'll only use your details to welcome you and follow up on your visit.",
  partner:
    "We'll use your details to pray for you and keep you posted as a partner.",
  care_dropoff:
    "We'll only use your details to plan your drop-off and say thank you.",
  dc_interest:
    "We'll only use your details to tell you about the next David's Company training.",
  event_notify:
    "We'll only email you about upcoming Tribe events. You can opt out any time.",
  merch_drop:
    "We'll only message you about new Tribe merch drops. You can opt out any time.",
  newsletter: "We'll only email you Tribe news. You can opt out any time.",
};

export const RECEIVED = { status: 'received' as const };

@Injectable()
export class WebsiteFormsService {
  private readonly logger = new Logger(WebsiteFormsService.name);

  constructor(
    @InjectModel(WebFormSubmission.name)
    private readonly submissions: Model<WebFormSubmissionDocument>,
    @InjectModel(WebSubscription.name)
    private readonly subscriptions: Model<WebSubscriptionDocument>,
    @InjectModel(Branch.name)
    private readonly branches: Model<BranchDocument>,
    @InjectModel(FirstTimer.name)
    private readonly firstTimerModel: Model<FirstTimerDocument>,
    private readonly firstTimers: FirstTimersService,
    private readonly templates: EmailTemplateResolverService,
    private readonly email: EmailProvider,
  ) {}

  // ─── Forms ───────────────────────────────────────────────────────────

  /**
   * Plan a visit: inbox submission + a CRM first-timer (created, or matched
   * by phone + email + first name) + a confirmation email when an email was
   * given. The visit is stored even if the first-timer or email step fails.
   */
  async visit(dto: VisitFormDto) {
    if (dto.website) return RECEIVED; // honeypot: pretend it worked
    const branch = await this.branch(dto.branch);
    const name = `${dto.firstName} ${dto.lastName}`;
    const submission = await this.submissions.create({
      formType: WebFormType.VISIT,
      payload: { visitDate: dto.visitDate, note: dto.note ?? null },
      contact: { name, email: dto.email, phone: dto.phone },
      branch: branch._id,
      consent: { text: CONSENT.visit, version: CONSENT_VERSION },
      source: dto.source ?? null,
    });

    try {
      const existing = await this.matchFirstTimer(
        dto.phone,
        dto.email,
        dto.firstName,
      );
      const firstTimer =
        existing ??
        (await this.firstTimers.createWithBranch(
          {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            email: dto.email,
            dateOfVisit: lagosMidnight(dto.visitDate).toISOString(),
            visitorType: 'first_time',
            howDidYouHear: 'website',
            notes:
              `Planned visit via the website for ${dto.visitDate}.` +
              (dto.note ? ` Note: ${dto.note}` : ''),
          } as PublicCreateFirstTimerDto,
          branch._id,
        ));
      submission.firstTimer = firstTimer._id as Types.ObjectId;
      await submission.save();
    } catch (err) {
      this.logger.error(
        `Visit ${String(submission._id)}: could not create/link first-timer`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    if (dto.email) {
      await this.sendVisitConfirmation(dto, branch);
    }
    return RECEIVED;
  }

  async partner(dto: PartnerFormDto) {
    if (dto.website) return RECEIVED;
    const branch = await this.branch(dto.branch);
    await this.submissions.create({
      formType: WebFormType.PARTNER,
      payload: {
        monthlyAmount: dto.monthlyAmount,
        currency: 'NGN',
        method: dto.method,
      },
      contact: {
        name: `${dto.firstName} ${dto.lastName}`,
        email: dto.email,
        phone: dto.phone,
      },
      branch: branch._id,
      consent: { text: CONSENT.partner, version: CONSENT_VERSION },
      source: dto.source ?? null,
    });
    return RECEIVED;
  }

  async careDropoff(dto: CareDropoffFormDto) {
    if (dto.website) return RECEIVED;
    const branch = await this.branch(dto.branch);
    await this.submissions.create({
      formType: WebFormType.CARE_DROPOFF,
      payload: { kinds: dto.kinds, dropoffDate: dto.dropoffDate },
      contact: { name: dto.name, phone: dto.phone },
      branch: branch._id,
      consent: { text: CONSENT.care_dropoff, version: CONSENT_VERSION },
      source: dto.source ?? null,
    });
    return RECEIVED;
  }

  async dcInterest(dto: DcInterestFormDto) {
    if (dto.website) return RECEIVED;
    const branch = await this.branch(dto.branch);
    await this.submissions.create({
      formType: WebFormType.DC_INTEREST,
      payload: { unit: dto.unit ?? null, note: dto.note ?? null },
      contact: {
        name: `${dto.firstName} ${dto.lastName}`,
        email: dto.email,
        phone: dto.phone,
      },
      branch: branch._id,
      consent: { text: CONSENT.dc_interest, version: CONSENT_VERSION },
      source: dto.source ?? null,
    });
    return RECEIVED;
  }

  async eventNotify(dto: EventNotifyFormDto) {
    if (dto.website) return RECEIVED;
    await this.submissions.create({
      formType: WebFormType.EVENT_NOTIFY,
      payload: { event: dto.event ?? null },
      contact: { name: dto.name ?? '', email: dto.email },
      consent: { text: CONSENT.event_notify, version: CONSENT_VERSION },
      source: dto.source ?? null,
    });
    return RECEIVED;
  }

  /** Merch drop / newsletter sign-up. Signing up twice gives the same reply. */
  async subscribe(dto: SubscribeDto) {
    if (dto.website) return RECEIVED;
    const { channel, address } = this.parseContact(dto.contact);
    await this.subscriptions.updateOne(
      { list: dto.list, channel, address },
      {
        $setOnInsert: {
          list: dto.list,
          channel,
          address,
          consent: { text: CONSENT[dto.list], version: CONSENT_VERSION },
          source: dto.source ?? null,
        },
        $set: { status: 'active' },
      },
      { upsert: true },
    );
    return RECEIVED;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private async branch(slug: string) {
    const branch = await this.branches
      .findOne({ slug, isActive: true })
      .select('_id name slug address')
      .lean<{
        _id: Types.ObjectId;
        name: string;
        slug: string;
        address?: Branch['address'];
      }>()
      .exec();
    if (!branch) throw new BadRequestException('Choose a campus.');
    return branch;
  }

  /**
   * Same rule as FirstTimersService.findDuplicate (phone + email + first
   * name, case-insensitive, active) but with the name regex-escaped, because
   * this input comes from a public form.
   */
  private matchFirstTimer(
    phone: string,
    email: string | undefined,
    firstName: string,
  ) {
    return this.firstTimerModel
      .findOne({
        phone,
        ...(email ? { email } : { email: { $in: [null, ''] } }),
        firstName: new RegExp(`^${escapeRegex(firstName)}$`, 'i'),
        isActive: true,
      })
      .exec();
  }

  private parseContact(contact: string): {
    channel: SubscriptionChannel;
    address: string;
  } {
    if (contact.includes('@')) {
      const address = contact.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
        throw new BadRequestException('Enter a valid email address.');
      }
      return { channel: SubscriptionChannel.EMAIL, address };
    }
    const address = contact.replace(/[\s().-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(address)) {
      throw new BadRequestException(
        'Enter a valid email address or WhatsApp number.',
      );
    }
    return { channel: SubscriptionChannel.WHATSAPP, address };
  }

  private async sendVisitConfirmation(
    dto: VisitFormDto,
    branch: { _id: Types.ObjectId; name: string; address?: Branch['address'] },
  ) {
    try {
      const a = branch.address;
      const address = [a?.street, a?.city, a?.state].filter(Boolean).join(', ');
      // Template substitution doesn't escape, so every value is escaped here.
      const { subject, html } = await this.templates.resolveTemplate(
        'website.visit-confirmation',
        {
          firstName: escapeHtml(dto.firstName),
          campusName: escapeHtml(branch.name),
          visitDate: escapeHtml(formatLagosDate(dto.visitDate)),
          campusAddress: escapeHtml(address),
        },
        String(branch._id),
      );
      await this.email.sendEmail({ to: dto.email!, subject, html });
    } catch (err) {
      this.logger.error(
        'Could not send the plan-a-visit confirmation email',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}

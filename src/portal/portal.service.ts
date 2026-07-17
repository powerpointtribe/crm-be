import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  PortalAccount,
  PortalAccountDocument,
  PortalAccountStatus,
} from './schemas/portal-account.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from '../events/schemas/event-registration.schema';
import { Event, EventDocument } from '../events/schemas/event.schema';
import {
  JobType,
  QueueName,
} from '../common/interfaces/queue-job.interface';

const SETUP_TOKEN_TTL_DAYS = 14;

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectModel(PortalAccount.name)
    private readonly accountModel: Model<PortalAccountDocument>,
    @InjectModel(EventRegistration.name)
    private readonly registrationModel: Model<EventRegistrationDocument>,
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS)
    private readonly emailQueue: Queue,
    private readonly jwtService: JwtService,
  ) {}

  // ---- helpers -------------------------------------------------------------

  private signToken(account: PortalAccountDocument): string {
    return this.jwtService.sign({
      sub: account._id.toString(),
      typ: 'portal',
      email: account.email,
    });
  }

  private buildProfile(account: PortalAccountDocument) {
    return {
      id: account._id.toString(),
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      status: account.status,
    };
  }

  private setupUrlFor(event: EventDocument | null, token: string): string {
    const base =
      event?.registrationSettings?.applicationBaseUrl ||
      process.env.FRONTEND_URL ||
      '';
    return `${base.replace(/\/+$/, '')}/portal/set-password?token=${token}`;
  }

  /**
   * Ensure a PortalAccount exists for this registration WITHOUT emailing a
   * set-password invite. Called on acceptance — the invite is now sent
   * separately, manually, by an admin on a chosen day.
   */
  async ensureAccount(
    registration: EventRegistrationDocument,
  ): Promise<{ email: string | null }> {
    const email = (registration.attendeeInfo?.email || '')
      .trim()
      .toLowerCase();
    if (!email) return { email: null };

    const existing = await this.accountModel.findOne({ email });
    if (!existing) {
      await new this.accountModel({
        email,
        firstName: registration.attendeeInfo?.firstName,
        lastName: registration.attendeeInfo?.lastName,
        status: PortalAccountStatus.INVITED,
      }).save();
    }
    return { email };
  }

  /**
   * Ensure a PortalAccount exists for this registration, (re)issue a setup
   * token and email the invite link. Called when an admin manually sends the
   * set-password invite (individually or to all accepted), and when a learner
   * asks to (re)set their password.
   */
  async provisionAndInvite(
    registration: EventRegistrationDocument,
    event: EventDocument,
  ): Promise<{ sentTo: string | null }> {
    const email = (registration.attendeeInfo?.email || '')
      .trim()
      .toLowerCase();
    if (!email) return { sentTo: null };

    let account = await this.accountModel.findOne({ email });
    if (!account) {
      account = new this.accountModel({
        email,
        firstName: registration.attendeeInfo?.firstName,
        lastName: registration.attendeeInfo?.lastName,
        status: PortalAccountStatus.INVITED,
      });
    }

    account.setupToken = randomBytes(24).toString('hex');
    account.setupTokenExpiresAt = new Date(
      Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await account.save();

    const setupUrl = this.setupUrlFor(event, account.setupToken);

    await this.emailQueue
      .add(JobType.PORTAL_INVITE, {
        email,
        firstName: registration.attendeeInfo?.firstName,
        eventTitle: event.title,
        setupUrl,
        senderEmail: event.registrationSettings?.senderEmail,
        senderName: event.registrationSettings?.senderName,
      })
      .catch((err) =>
        this.logger.error(`Failed to queue portal invite for ${email}: ${err.message}`),
      );

    return { sentTo: email };
  }

  // ---- public auth flows ---------------------------------------------------

  /**
   * Re-issue a setup/login link. Only does anything if an *accepted*
   * registration exists for the email — otherwise silently succeeds (no email
   * enumeration). Always returns the same generic response.
   */
  async requestSetup(
    email: string,
    eventSlug?: string,
  ): Promise<{ success: true }> {
    const normalized = (email || '').trim().toLowerCase();
    const generic = { success: true as const };
    if (!normalized) return generic;

    const filter: Record<string, any> = {
      'attendeeInfo.email': normalized,
      admissionStatus: 'accepted',
    };
    if (eventSlug) {
      const ev = await this.eventModel
        .findOne({ registrationSlug: eventSlug })
        .select('_id')
        .lean();
      if (ev) filter.event = ev._id;
    }

    const registration = await this.registrationModel
      .findOne(filter)
      .sort({ acceptedAt: -1 });
    if (!registration) return generic;

    const event = await this.eventModel.findById(registration.event);
    if (!event) return generic;

    await this.provisionAndInvite(registration, event);
    return generic;
  }

  async setPassword(
    token: string,
    password: string,
  ): Promise<{ accessToken: string; profile: any }> {
    const account = await this.accountModel.findOne({ setupToken: token });
    if (
      !account ||
      !account.setupTokenExpiresAt ||
      account.setupTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'This link is invalid or has expired. Please request a new one.',
      );
    }

    account.passwordHash = await bcrypt.hash(password, 10);
    account.status = PortalAccountStatus.ACTIVE;
    account.setupToken = undefined;
    account.setupTokenExpiresAt = undefined;
    account.lastLoginAt = new Date();
    await account.save();

    return { accessToken: this.signToken(account), profile: this.buildProfile(account) };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; profile: any }> {
    const normalized = (email || '').trim().toLowerCase();
    const account = await this.accountModel.findOne({ email: normalized });
    if (
      !account ||
      account.status !== PortalAccountStatus.ACTIVE ||
      !account.passwordHash
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    account.lastLoginAt = new Date();
    await account.save();

    return { accessToken: this.signToken(account), profile: this.buildProfile(account) };
  }

  async me(account: PortalAccountDocument): Promise<{ profile: any }> {
    return { profile: this.buildProfile(account) };
  }

  /** Accepted events for this learner (by email) — for multi-event support. */
  async myEvents(account: PortalAccountDocument) {
    const regs = await this.registrationModel
      .find({
        'attendeeInfo.email': account.email,
        admissionStatus: 'accepted',
      })
      .populate('event', 'title registrationSlug startDate endDate status')
      .lean();
    return regs.map((r) => ({
      registrationId: r._id,
      checkInCode: r.checkInCode,
      event: r.event,
    }));
  }
}

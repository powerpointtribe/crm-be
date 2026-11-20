import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import {
  CreateDonationDto,
  DonationQueryDto,
  DonationRangeDto,
} from '../dto/giving.dto';
import {
  DONATION_REFERENCE,
  Donation,
  DonationDocument,
  DonationStatus,
  GivingCounter,
  GivingCounterDocument,
} from '../schemas/giving.schemas';
import { FlutterwaveClient, FlutterwaveError } from './flutterwave.client';

/** One provider lookup per donation per 10 s, however often the page polls. */
export const STATUS_CHECK_INTERVAL_MS = 10_000;
export const EXPORT_MAX_ROWS = 50_000;

const txIdField = (txId?: number | string) =>
  txId === undefined || txId === null ? {} : { flutterwaveTxId: String(txId) };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Neutralise spreadsheet formulas (=, +, -, @, tab, CR) and quote the cell. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectModel(Donation.name)
    private readonly donationModel: Model<DonationDocument>,
    @InjectModel(GivingCounter.name)
    private readonly counterModel: Model<GivingCounterDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    private readonly flutterwave: FlutterwaveClient,
    private readonly config: ConfigService,
  ) {}

  private get websiteUrl(): string {
    return (this.config.get<string>('WEBSITE_URL') || '').replace(/\/+$/, '');
  }

  providers() {
    return this.flutterwave.isConfigured
      ? [{ id: 'flutterwave', label: 'Flutterwave' }]
      : [];
  }

  // ─── Public ──────────────────────────────────────────────────────────

  async create(dto: CreateDonationDto) {
    // Honeypot: a person never fills the hidden field (same as the ref checkout: 400).
    if (dto.website?.trim()) {
      throw new BadRequestException('We could not process this request.');
    }
    if (!this.flutterwave.isConfigured || !this.websiteUrl) {
      throw new ServiceUnavailableException(
        'Online giving is not available right now. Please give by bank transfer.',
      );
    }
    const branch = await this.branchModel
      .findOne({ slug: dto.branch, isActive: true })
      .select('name')
      .lean();
    if (!branch)
      throw new BadRequestException('branch must be an active campus');

    const reference = `PPTG-${new Types.ObjectId().toHexString()}`;
    const donation = await this.donationModel.create({
      reference,
      fund: dto.fund,
      amount: dto.amount,
      currency: 'NGN',
      branch: branch._id,
      donor: { name: dto.name, email: dto.email, phone: dto.phone },
      source: dto.source,
    });

    try {
      const paymentLink = await this.flutterwave.createPaymentLink({
        tx_ref: reference,
        amount: dto.amount,
        currency: 'NGN',
        redirect_url: `${this.websiteUrl}/give/thank-you?reference=${reference}`,
        customer: {
          email: dto.email,
          name: dto.name || undefined,
          phone_number: dto.phone || undefined,
        },
        customizations: {
          title: 'PowerPoint Tribe giving',
          description: `${dto.fund[0].toUpperCase()}${dto.fund.slice(1)} · ${branch.name}`,
        },
        payment_options: 'card,banktransfer,ussd',
        meta: { donationId: String(donation._id), fund: dto.fund },
      });
      return { reference, paymentLink };
    } catch (err) {
      if (!(err instanceof FlutterwaveError)) throw err;
      await this.donationModel.updateOne(
        { _id: donation._id, status: DonationStatus.PENDING },
        {
          $set: {
            status: DonationStatus.FAILED,
            failureReason: 'provider_error',
          },
        },
      );
      throw new BadGatewayException(
        "We couldn't start the payment. Please try again in a moment.",
      );
    }
  }

  /**
   * Public status for the thank-you page. While pending, asks Flutterwave at
   * most once every 10 s (atomic claim on lastCheckedAt), so polling can
   * settle a payment even if the webhook is late.
   */
  async status(reference: string) {
    if (!DONATION_REFERENCE.test(reference)) {
      throw new BadRequestException(
        'reference is not a valid giving reference',
      );
    }
    let donation = await this.donationModel.findOne({ reference }).lean();
    if (!donation) throw new NotFoundException('Donation not found');

    if (donation.status === DonationStatus.PENDING) {
      const now = new Date();
      const claimed = await this.donationModel
        .findOneAndUpdate(
          {
            _id: donation._id,
            status: DonationStatus.PENDING,
            $or: [
              { lastCheckedAt: null },
              {
                lastCheckedAt: {
                  $lt: new Date(now.getTime() - STATUS_CHECK_INTERVAL_MS),
                },
              },
            ],
          },
          { $set: { lastCheckedAt: now } },
          { new: true },
        )
        .lean();
      if (claimed) {
        donation = (await this.verify(claimed)) ?? donation;
      }
    }
    if (donation.status === DonationStatus.SUCCESSFUL && !donation.receiptNo) {
      donation =
        (await this.assignReceipt(
          donation._id,
          donation.verifiedAt ?? new Date(),
        )) ?? donation;
    }

    return {
      reference: donation.reference,
      status: donation.status,
      amount: donation.amount,
      currency: donation.currency,
      fund: donation.fund,
      receiptNo: donation.receiptNo ?? null,
    };
  }

  /**
   * Flutterwave webhook (dispatched from the store webhook for PPTG- refs,
   * after its verif-hash check). The payload is only a hint: the amount and
   * status come from Flutterwave's verify API, never from the payload.
   */
  async handleWebhook(payload: unknown): Promise<void> {
    const txRef = (payload as { data?: { tx_ref?: unknown } })?.data?.tx_ref;
    if (typeof txRef !== 'string' || !DONATION_REFERENCE.test(txRef)) return;
    const donation = await this.donationModel
      .findOne({ reference: txRef })
      .lean();
    if (!donation) {
      this.logger.warn(`Webhook for unknown donation ${txRef}`);
      return;
    }
    if (donation.status !== DonationStatus.PENDING) return;
    await this.verify(donation);
  }

  /** Ask Flutterwave and settle. Returns the updated donation, or null if still pending. */
  private async verify(donation: Donation & { _id: Types.ObjectId }) {
    const tx = await this.flutterwave.verifyByReference(donation.reference);
    if (!tx) return null;
    if (tx.status === 'successful') {
      const sameMoney =
        Number(tx.amount) === donation.amount &&
        String(tx.currency).toUpperCase() === donation.currency;
      return sameMoney
        ? this.settle(donation._id, tx.id)
        : this.fail(donation._id, 'amount_mismatch', tx.id);
    }
    if (tx.status === 'failed' || tx.status === 'cancelled') {
      return this.fail(donation._id, 'provider_failed', tx.id);
    }
    return null;
  }

  /** pending → successful exactly once; only the winner gets a receipt number. */
  private async settle(id: Types.ObjectId, txId?: number | string) {
    const won = await this.donationModel
      .findOneAndUpdate(
        { _id: id, status: DonationStatus.PENDING },
        {
          $set: {
            status: DonationStatus.SUCCESSFUL,
            verifiedAt: new Date(),
            ...txIdField(txId),
          },
        },
        { new: true },
      )
      .lean();
    if (!won) return this.donationModel.findById(id).lean();
    return this.assignReceipt(id, won.verifiedAt ?? new Date());
  }

  /**
   * Give a successful donation its receipt number, once. Also called when a
   * successful donation is read without one (e.g. the process died between
   * settling and numbering), so a missing number heals itself.
   */
  private async assignReceipt(id: Types.ObjectId, verifiedAt: Date) {
    const year = verifiedAt.getUTCFullYear();
    const seq = await this.nextSeq(`donation-receipt-${year}`);
    const receiptNo = `PPT-${year}-${String(seq).padStart(6, '0')}`;
    const updated = await this.donationModel
      .findOneAndUpdate(
        { _id: id, receiptNo: { $exists: false } },
        { $set: { receiptNo } },
        { new: true },
      )
      .lean();
    return updated ?? this.donationModel.findById(id).lean();
  }

  /**
   * Atomic counter. Concurrent first-of-the-year upserts on the unique key are
   * retried by MongoDB itself (4.2+), so no retry loop is needed here.
   */
  private async nextSeq(key: string): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true },
      )
      .lean();
    return counter.seq;
  }

  private async fail(
    id: Types.ObjectId,
    reason: string,
    txId?: number | string,
  ) {
    this.logger.warn(`Donation ${String(id)} failed: ${reason}`);
    await this.donationModel.updateOne(
      { _id: id, status: DonationStatus.PENDING },
      {
        $set: {
          status: DonationStatus.FAILED,
          failureReason: reason,
          ...txIdField(txId),
        },
      },
    );
    return this.donationModel.findById(id).lean();
  }

  // ─── Staff ───────────────────────────────────────────────────────────

  private filter(
    q: DonationQueryDto | DonationRangeDto,
  ): FilterQuery<Donation> {
    const f: FilterQuery<Donation> = {};
    if (q.from || q.to) {
      f.createdAt = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lt: q.to } : {}),
      };
    }
    if ('fund' in q && q.fund) f.fund = q.fund;
    if ('branch' in q && q.branch) f.branch = new Types.ObjectId(q.branch);
    if ('status' in q && q.status) f.status = q.status;
    if ('search' in q && q.search?.trim()) {
      const rx = new RegExp(escapeRegex(q.search.trim().slice(0, 100)), 'i');
      f.$or = [{ reference: rx }, { receiptNo: rx }, { 'donor.email': rx }];
    }
    return f;
  }

  async list(q: DonationQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter = this.filter(q);
    const [data, total] = await Promise.all([
      this.donationModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'name slug')
        .select('-lastCheckedAt')
        .lean(),
      this.donationModel.countDocuments(filter),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  /** Successful donations only, grouped by currency and fund. No donor data. */
  async totals(q: DonationRangeDto) {
    const rows = await this.donationModel.aggregate<{
      _id: { currency: string; fund: string };
      total: number;
      count: number;
    }>([
      { $match: { ...this.filter(q), status: DonationStatus.SUCCESSFUL } },
      {
        $group: {
          _id: { currency: '$currency', fund: '$fund' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.currency': 1, '_id.fund': 1 } },
    ]);
    return rows.map((r) => ({
      currency: r._id.currency,
      fund: r._id.fund,
      total: r.total,
      count: r.count,
    }));
  }

  /** CSV of matching donations (max 50k rows), formula-injection safe. */
  async exportCsv(q: DonationQueryDto): Promise<{ csv: string; rows: number }> {
    const docs = await this.donationModel
      .find(this.filter(q))
      .sort({ createdAt: -1 })
      .limit(EXPORT_MAX_ROWS)
      .populate('branch', 'name')
      .lean();
    const header = [
      'Receipt',
      'Reference',
      'Date',
      'Status',
      'Fund',
      'Amount',
      'Currency',
      'Campus',
      'Name',
      'Email',
      'Phone',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const d of docs) {
      const createdAt = (d as { createdAt?: Date }).createdAt;
      const branch = d.branch as unknown as { name?: string } | null;
      lines.push(
        [
          d.receiptNo,
          d.reference,
          createdAt ? createdAt.toISOString() : '',
          d.status,
          d.fund,
          d.amount,
          d.currency,
          branch?.name,
          d.donor?.name,
          d.donor?.email,
          d.donor?.phone,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return { csv: `${lines.join('\r\n')}\r\n`, rows: docs.length };
  }
}

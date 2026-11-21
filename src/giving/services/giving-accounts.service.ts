import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../../branches/schemas/branch.schema';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import {
  CreateGivingAccountDto,
  GivingAccountQueryDto,
  UpdateGivingAccountDto,
} from '../dto/giving.dto';
import {
  ACCOUNT_EDITABLE_FIELDS,
  AccountApprovalStatus,
  GivingAccount,
  GivingAccountDocument,
} from '../schemas/giving.schemas';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Refs stored as ObjectIds; null clears. */
function normalise(dto: UpdateGivingAccountDto): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ACCOUNT_EDITABLE_FIELDS) {
    const value = (dto as Record<string, unknown>)[key];
    if (value === undefined) continue;
    out[key] =
      key === 'branch' && typeof value === 'string'
        ? new Types.ObjectId(value)
        : key === 'swift' && typeof value === 'string'
          ? value.toUpperCase()
          : value;
  }
  return out;
}

const sameActor = (a?: Types.ObjectId | null, b?: Types.ObjectId | null) =>
  !!a && !!b && String(a) === String(b);

/**
 * Giving accounts with maker/checker: drafts and changes to approved
 * accounts only reach the website after someone else approves them.
 */
@Injectable()
export class GivingAccountsService {
  constructor(
    @InjectModel(GivingAccount.name)
    private readonly model: Model<GivingAccountDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────

  /**
   * Approved accounts only (pending changes stay hidden). With a campus slug:
   * that campus's accounts plus shared ones; an unknown slug gets shared only.
   * Campus accounts first (by campus name, then order), shared accounts last.
   */
  async publicList(branchSlug?: string) {
    const filter: FilterQuery<GivingAccount> = {
      approvalStatus: AccountApprovalStatus.APPROVED,
    };
    if (branchSlug) {
      const branch = await this.branchModel
        .findOne({ slug: branchSlug, isActive: true })
        .select('_id')
        .lean();
      filter.branch = branch ? { $in: [branch._id, null] } : null;
    }
    const docs = await this.model
      .find(filter)
      .populate('branch', 'slug name')
      .lean();
    const name = (d: (typeof docs)[number]) =>
      (d.branch as unknown as { name?: string } | null)?.name ?? null;
    docs.sort((a, b) => {
      const an = name(a);
      const bn = name(b);
      if (an === null && bn !== null) return 1;
      if (bn === null && an !== null) return -1;
      if (an !== bn) return String(an).localeCompare(String(bn));
      return (a.order ?? 0) - (b.order ?? 0);
    });
    return docs.map((d) => {
      const branch = d.branch as unknown as {
        slug?: string;
        name?: string;
      } | null;
      return {
        _id: d._id,
        currency: d.currency,
        bank: d.bank,
        accountNumber: d.accountNumber,
        accountName: d.accountName ?? null,
        swift: d.swift ?? null,
        branch: branch
          ? { slug: branch.slug ?? null, name: branch.name ?? null }
          : null,
      };
    });
  }

  // ─── Staff ───────────────────────────────────────────────────────────

  async list(q: GivingAccountQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter: FilterQuery<GivingAccount> = {};
    if (q.currency) filter.currency = q.currency;
    if (q.approvalStatus) filter.approvalStatus = q.approvalStatus;
    if (q.branch)
      filter.branch = q.branch === 'none' ? null : new Types.ObjectId(q.branch);
    if (q.search?.trim()) {
      const rx = new RegExp(escapeRegex(q.search.trim().slice(0, 100)), 'i');
      filter.$or = [{ bank: rx }, { accountName: rx }, { accountNumber: rx }];
    }
    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ branch: 1, order: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'slug name')
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    if (!isValidObjectId(id))
      throw new NotFoundException('Giving account not found');
    const doc = await this.model
      .findById(id)
      .populate('branch', 'slug name')
      .lean();
    if (!doc) throw new NotFoundException('Giving account not found');
    return doc;
  }

  /** Always a draft: nothing new is public until someone else approves it. */
  async create(dto: CreateGivingAccountDto, actor: Types.ObjectId) {
    const doc = await this.model.create({
      ...normalise(dto),
      approvalStatus: AccountApprovalStatus.DRAFT,
      draftedBy: actor,
      createdBy: actor,
      updatedBy: actor,
    });
    return doc.toObject();
  }

  /** Drafts are edited in place; approved accounts get (merged) pending changes. */
  async update(id: string, dto: UpdateGivingAccountDto, actor: Types.ObjectId) {
    const doc = await this.load(id);
    const fields = normalise(dto);
    if (doc.approvalStatus === AccountApprovalStatus.DRAFT) {
      Object.assign(doc, fields, { draftedBy: actor, updatedBy: actor });
    } else {
      doc.pendingChange = {
        fields: { ...(doc.pendingChange?.fields ?? {}), ...fields },
        requestedBy: actor,
        requestedAt: new Date(),
      };
      doc.markModified('pendingChange');
      doc.updatedBy = actor;
    }
    await doc.save();
    return doc.toObject();
  }

  /** Approve a draft or a pending change. The maker can't approve their own. */
  async approve(id: string, actor: Types.ObjectId) {
    const doc = await this.load(id);
    if (doc.approvalStatus === AccountApprovalStatus.DRAFT) {
      if (sameActor(doc.draftedBy, actor)) throw this.ownWork();
      doc.approvalStatus = AccountApprovalStatus.APPROVED;
    } else if (doc.pendingChange) {
      if (sameActor(doc.pendingChange.requestedBy, actor)) throw this.ownWork();
      Object.assign(doc, doc.pendingChange.fields);
      doc.pendingChange = null;
      doc.markModified('pendingChange');
    } else {
      throw new ConflictException(
        'Nothing is waiting for approval on this account.',
      );
    }
    doc.approvedBy = actor;
    doc.approvedAt = new Date();
    doc.updatedBy = actor;
    await doc.save();
    return doc.toObject();
  }

  /** Drop a pending change on an approved account. */
  async reject(id: string, actor: Types.ObjectId) {
    const doc = await this.load(id);
    if (!doc.pendingChange) {
      throw new ConflictException('There is no pending change to reject.');
    }
    doc.pendingChange = null;
    doc.markModified('pendingChange');
    doc.updatedBy = actor;
    await doc.save();
    return doc.toObject();
  }

  /** Only drafts can be deleted (approved accounts are public). */
  async remove(id: string) {
    const doc = await this.load(id);
    if (doc.approvalStatus !== AccountApprovalStatus.DRAFT) {
      throw new ConflictException(
        'Approved accounts are on the website and cannot be deleted here.',
      );
    }
    await doc.deleteOne();
  }

  private async load(id: string) {
    if (!isValidObjectId(id))
      throw new NotFoundException('Giving account not found');
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Giving account not found');
    return doc;
  }

  private ownWork() {
    return new ForbiddenException(
      'Someone else has to approve this: you drafted or requested it.',
    );
  }
}

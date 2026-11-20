import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { createPaginatedResult } from '../common/utils/pagination.util';
import { containsRegex } from '../website/utils/text.util';
import {
  ClaimsQueryDto,
  CreateClaimDto,
  CreateLostItemDto,
  LostItemsQueryDto,
  PublicLostItemsQueryDto,
  UpdateLostItemDto,
} from './dto/lost-found.dto';
import {
  ClaimStatus,
  LostItemClaim,
  LostItemClaimDocument,
} from './schemas/lost-item-claim.schema';
import {
  listedUntilFor,
  LostItem,
  LostItemDocument,
  LostItemStatus,
} from './schemas/lost-item.schema';
import { maskPhone } from './utils/mask.util';

const PUBLIC_STATUSES = [LostItemStatus.LISTED, LostItemStatus.CLAIM_PENDING];

/**
 * Status changes staff may make by hand. `claim_pending` is entered and left
 * only through a claim (public claim / claim review), never by PATCH.
 */
const ALLOWED_MOVES: Record<LostItemStatus, LostItemStatus[]> = {
  [LostItemStatus.PENDING_REVIEW]: [
    LostItemStatus.LISTED,
    LostItemStatus.MOVED_TO_CARE_CLOSET,
  ],
  [LostItemStatus.LISTED]: [
    LostItemStatus.PENDING_REVIEW,
    LostItemStatus.COLLECTED,
    LostItemStatus.MOVED_TO_CARE_CLOSET,
  ],
  [LostItemStatus.CLAIM_PENDING]: [],
  [LostItemStatus.COLLECTED]: [LostItemStatus.LISTED],
  [LostItemStatus.MOVED_TO_CARE_CLOSET]: [LostItemStatus.LISTED],
};

type BranchRef = { _id: Types.ObjectId; name?: string; slug?: string };

@Injectable()
export class LostFoundService {
  private readonly logger = new Logger(LostFoundService.name);

  constructor(
    @InjectModel(LostItem.name)
    private readonly itemModel: Model<LostItemDocument>,
    @InjectModel(LostItemClaim.name)
    private readonly claimModel: Model<LostItemClaimDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────

  async publicList(q: PublicLostItemsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 8;
    const filter: FilterQuery<LostItem> = { status: { $in: PUBLIC_STATUSES } };
    if (q.type) filter.type = q.type;
    if (q.branch) {
      const branch = await this.branchModel
        .findOne({ slug: q.branch })
        .select('_id')
        .lean()
        .exec();
      // Unknown campus matches nothing.
      filter.branch = branch?._id ?? new Types.ObjectId();
    }
    if (q.search?.trim()) filter.description = containsRegex(q.search);

    const [docs, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .sort({ foundOn: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'slug name address')
        .lean()
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(
      docs.map((d) => this.publicShape(d)),
      total,
      page,
      limit,
    );
  }

  /**
   * "This is mine". Moves the item listed → claim_pending atomically, so two
   * people can't both claim it; then records the claim (rolled back if that
   * insert fails).
   */
  async claim(id: string, dto: CreateClaimDto) {
    if (!isValidObjectId(id)) throw this.itemNotFound();

    // Honeypot filled: same reply as a real claim, nothing stored.
    if (dto.website?.trim()) {
      const item = await this.itemModel
        .findOne({ _id: id, status: { $in: PUBLIC_STATUSES } })
        .populate('branch', 'name')
        .lean()
        .exec();
      return this.claimReceived(item?.branch as BranchRef | undefined);
    }

    const item = await this.itemModel
      .findOneAndUpdate(
        { _id: id, status: LostItemStatus.LISTED },
        { $set: { status: LostItemStatus.CLAIM_PENDING } },
        { new: true },
      )
      .populate('branch', 'name')
      .lean()
      .exec();
    if (!item) {
      const current = await this.itemModel
        .findById(id)
        .select('status')
        .lean()
        .exec();
      if (current?.status === LostItemStatus.CLAIM_PENDING) {
        throw new ConflictException(
          'Someone has already claimed this item. Speak to the Tribe’s Heart desk if it is yours.',
        );
      }
      throw this.itemNotFound();
    }

    try {
      await this.claimModel.create({
        lostItem: item._id,
        claimant: { name: dto.name.trim(), phone: dto.phone.trim() },
        proof: dto.proof.trim(),
      });
    } catch (err) {
      await this.itemModel
        .updateOne(
          { _id: item._id, status: LostItemStatus.CLAIM_PENDING },
          { $set: { status: LostItemStatus.LISTED } },
        )
        .exec();
      throw err;
    }
    return this.claimReceived(item.branch as unknown as BranchRef);
  }

  // ─── Staff: items ────────────────────────────────────────────────────

  async create(
    dto: CreateLostItemDto,
    actorId: Types.ObjectId,
    canManage: boolean,
  ) {
    if (dto.status === LostItemStatus.LISTED && !canManage) {
      throw new ForbiddenException(
        "Your post goes to the care desk for review first. Listing it straight away needs the 'lost-found:manage' permission.",
      );
    }
    await this.assertBranch(dto.branch);
    const doc = await this.itemModel.create({
      ...dto,
      branch: new Types.ObjectId(dto.branch),
      status: dto.status ?? LostItemStatus.PENDING_REVIEW,
      listedUntil: listedUntilFor(dto.foundOn),
      postedBy: actorId,
      updatedBy: actorId,
    });
    return doc.toObject();
  }

  async mine(actorId: Types.ObjectId) {
    return this.itemModel
      .find({ postedBy: actorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('branch', 'slug name')
      .lean()
      .exec();
  }

  async list(q: LostItemsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter: FilterQuery<LostItem> = {};
    if (q.status) filter.status = q.status;
    if (q.type) filter.type = q.type;
    if (q.branch) filter.branch = new Types.ObjectId(q.branch);
    if (q.search?.trim()) filter.description = containsRegex(q.search);
    const [data, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .sort({ foundOn: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('branch', 'slug name')
        .populate('postedBy', 'firstName lastName')
        .lean()
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    if (!isValidObjectId(id)) throw this.itemNotFound();
    const doc = await this.itemModel
      .findById(id)
      .populate('branch', 'slug name')
      .populate('postedBy', 'firstName lastName')
      .lean()
      .exec();
    if (!doc) throw this.itemNotFound();
    return doc;
  }

  async update(id: string, dto: UpdateLostItemDto, actorId: Types.ObjectId) {
    if (!isValidObjectId(id)) throw this.itemNotFound();
    const current = await this.itemModel.findById(id).lean().exec();
    if (!current) throw this.itemNotFound();

    const set: Record<string, unknown> = { ...dto, updatedBy: actorId };
    if (dto.status !== undefined && dto.status !== current.status) {
      if (!ALLOWED_MOVES[current.status].includes(dto.status)) {
        throw new ConflictException(
          current.status === LostItemStatus.CLAIM_PENDING
            ? 'This item has a pending claim. Approve or reject the claim instead.'
            : `An item can't move from ${current.status} to ${dto.status}.`,
        );
      }
    }
    if (dto.branch !== undefined) {
      await this.assertBranch(dto.branch);
      set.branch = new Types.ObjectId(dto.branch);
    }
    if (dto.foundOn !== undefined)
      set.listedUntil = listedUntilFor(dto.foundOn);

    // Conditional on the status we checked, so a claim racing this edit wins.
    const doc = await this.itemModel
      .findOneAndUpdate(
        { _id: id, status: current.status },
        { $set: set },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();
    if (!doc) {
      throw new ConflictException(
        'This item changed while you were editing it. Reload and try again.',
      );
    }
    return doc;
  }

  async remove(id: string) {
    if (!isValidObjectId(id)) throw this.itemNotFound();
    const item = await this.itemModel
      .findById(id)
      .select('status')
      .lean()
      .exec();
    if (!item) throw this.itemNotFound();
    if (item.status === LostItemStatus.CLAIM_PENDING) {
      throw new ConflictException(
        'This item has a pending claim. Approve or reject the claim first.',
      );
    }
    await this.itemModel.deleteOne({ _id: id }).exec();
    await this.claimModel.deleteMany({ lostItem: item._id }).exec();
  }

  // ─── Staff: claims ───────────────────────────────────────────────────

  async listClaims(q: ClaimsQueryDto, showPhone: boolean) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filter: FilterQuery<LostItemClaim> = {};
    if (q.status) filter.status = q.status;
    const [docs, total] = await Promise.all([
      this.claimModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'lostItem',
          select: 'description type status branch photoUrl foundOn',
          populate: { path: 'branch', select: 'slug name' },
        })
        .lean()
        .exec(),
      this.claimModel.countDocuments(filter).exec(),
    ]);
    const data = docs.map((c) => ({
      ...c,
      claimant: {
        name: c.claimant?.name,
        phone: showPhone ? c.claimant?.phone : maskPhone(c.claimant?.phone),
      },
    }));
    return createPaginatedResult(data, total, page, limit);
  }

  /** Approve (item → collected) or reject (item → listed again). */
  async reviewClaim(
    id: string,
    status: ClaimStatus.APPROVED | ClaimStatus.REJECTED,
    actorId: Types.ObjectId,
  ) {
    if (!isValidObjectId(id)) throw new NotFoundException('Claim not found');
    const existing = await this.claimModel.findById(id).lean().exec();
    if (!existing) throw new NotFoundException('Claim not found');

    const claim = await this.claimModel
      .findOneAndUpdate(
        { _id: id, status: ClaimStatus.PENDING },
        { $set: { status, reviewedBy: actorId, reviewedAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec();
    if (!claim) {
      throw new ConflictException(`This claim was already ${existing.status}.`);
    }
    await this.itemModel
      .updateOne(
        { _id: claim.lostItem, status: LostItemStatus.CLAIM_PENDING },
        {
          $set: {
            status:
              status === ClaimStatus.APPROVED
                ? LostItemStatus.COLLECTED
                : LostItemStatus.LISTED,
            updatedBy: actorId,
          },
        },
      )
      .exec();
    return claim;
  }

  // ─── Jobs ────────────────────────────────────────────────────────────

  /** Daily: unclaimed items past their 30 days go to the Care Closet. */
  @Cron('0 0 2 * * *', { timeZone: 'Africa/Lagos' })
  async expireListedItems(now = new Date()): Promise<number> {
    const res = await this.itemModel
      .updateMany(
        { status: LostItemStatus.LISTED, listedUntil: { $lte: now } },
        { $set: { status: LostItemStatus.MOVED_TO_CARE_CLOSET } },
      )
      .exec();
    if (res.modifiedCount) {
      this.logger.log(
        `Moved ${res.modifiedCount} unclaimed item(s) to the Care Closet`,
      );
    }
    return res.modifiedCount;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private publicShape(d: Record<string, any>) {
    const b = d.branch as BranchRef | null;
    return {
      _id: d._id,
      name: d.description,
      type: d.type,
      foundOn: d.foundOn,
      photoUrl: d.photoUrl ?? null,
      status: d.status === LostItemStatus.LISTED ? 'waiting' : 'claim_pending',
      branch: b && 'slug' in b ? { slug: b.slug, name: b.name } : null,
    };
  }

  private claimReceived(branch: BranchRef | undefined) {
    const campus = branch?.name ?? 'your campus';
    return {
      status: 'received' as const,
      instructions: `Collect it from the Tribe’s Heart desk at ${campus} after Sunday Service. Bring an ID or proof of ownership.`,
    };
  }

  private async assertBranch(id: string) {
    const exists = await this.branchModel.exists({ _id: id }).exec();
    if (!exists) throw new BadRequestException('branch: campus not found');
  }

  private itemNotFound() {
    return new NotFoundException('Item not found');
  }
}

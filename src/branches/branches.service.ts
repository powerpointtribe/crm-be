import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchWebsiteDto } from './dto/update-branch-website.dto';
import {
  WebPastor,
  WebPastorDocument,
} from '../website/schemas/web-content.schema';
import { publishedFilter } from '../website/schemas/publishing';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
    @InjectModel(WebPastor.name)
    private readonly pastorModel: Model<WebPastorDocument>,
  ) {}

  async create(createBranchDto: CreateBranchDto): Promise<BranchDocument> {
    const branch = new this.branchModel(createBranchDto);
    return branch.save();
  }

  async findAll(): Promise<BranchDocument[]> {
    return this.branchModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<BranchDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.branchModel.findById(id).exec();
  }

  async findBySlug(slug: string): Promise<BranchDocument | null> {
    return this.branchModel.findOne({ slug: slug.toLowerCase(), isActive: true }).exec();
  }

  async findMainBranch(): Promise<BranchDocument | null> {
    return this.branchModel.findOne({ isMainBranch: true, isActive: true }).exec();
  }

  /** Merge website fields (only keys that were sent). null if not found. */
  async updateWebsite(
    id: string,
    dto: UpdateBranchWebsiteDto,
  ): Promise<BranchDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      set[`website.${k}`] =
        k === 'pastor' && v !== null ? new Types.ObjectId(v as string) : v;
    }
    if (!Object.keys(set).length) return this.branchModel.findById(id).exec();
    return this.branchModel
      .findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true })
      .exec();
  }

  /**
   * Campuses for the public website: active, switched on, in order, with the
   * campus pastor if that website pastor profile is published.
   */
  async findWebsiteCampuses() {
    const branches = await this.branchModel
      .find({ isActive: true, 'website.showOnWebsite': true })
      .sort({ 'website.order': 1, name: 1 })
      .lean()
      .exec();
    const pastorIds = branches
      .map((b) => b.website?.pastor)
      .filter((id): id is Types.ObjectId => !!id);
    const pastors = pastorIds.length
      ? await this.pastorModel
          .find({ _id: { $in: pastorIds }, ...publishedFilter<WebPastor>() })
          .lean()
          .exec()
      : [];
    const byId = new Map(pastors.map((p) => [String(p._id), p]));
    return branches.map((b) => {
      const pastor = b.website?.pastor
        ? byId.get(String(b.website.pastor))
        : undefined;
      return {
        _id: b._id,
        slug: b.slug,
        name: b.name,
        venue: b.website?.venue ?? null,
        city: b.address?.city ?? null,
        address: b.address ?? null,
        phone: b.phone ?? null,
        email: b.email ?? null,
        isMain: !!b.isMainBranch,
        timezone: b.timezone ?? null,
        mapUrl: b.website?.mapUrl ?? null,
        photoUrl: b.website?.photoUrl ?? null,
        serviceTimes: (b.website?.serviceTimes ?? []).map(
          ({ label, day, time }) => ({ label, day, time }),
        ),
        pastor: pastor
          ? {
              name: pastor.name,
              role: pastor.role,
              photoUrl: pastor.photoUrl ?? null,
              photoAlt: pastor.photoAlt ?? null,
            }
          : null,
      };
    });
  }

  async update(
    id: string,
    updateData: Partial<Branch>,
  ): Promise<BranchDocument | null> {
    return this.branchModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  // NOTE: assignBranchPastor, addAssistantPastor, and removeAssistantPastor
  // have been removed. Role assignments are now managed through the
  // RoleAssignment entity. Use RoleAssignmentService to manage role
  // assignments with branch scope.

  async getBranchFormConfig(slug: string): Promise<any | null> {
    const branch = await this.findBySlug(slug);

    if (!branch) {
      return null;
    }

    // Return branch-specific form configuration
    return {
      branchId: branch._id,
      branchName: branch.name,
      branchSlug: branch.slug,
      title: branch.settings?.formTitle || `Welcome to ${branch.name}!`,
      subtitle:
        branch.settings?.formSubtitle || "We're excited to connect with you",
      successMessage:
        branch.settings?.successMessage ||
        'Thank you for your interest! Our team will contact you soon.',
      fields: {
        firstName: { required: true, label: 'First Name' },
        lastName: { required: true, label: 'Last Name' },
        phone: { required: true, label: 'Phone Number' },
        email: { required: true, label: 'Email Address' },
        address: { required: false, label: 'Address' },
        dateOfBirth: { required: false, label: 'Date of Birth' },
        occupation: { required: false, label: 'Occupation' },
        howDidYouHear: {
          required: false,
          label: 'How did you hear about us?',
          options: [
            'friend',
            'family',
            'advertisement',
            'online',
            'event',
            'walkby',
            'website',
            'social_media',
            'other',
          ],
        },
        interestedInJoining: {
          required: false,
          label: 'Interested in joining our church?',
        },
        prayerRequests: { required: false, label: 'Prayer Requests' },
        servingInterests: {
          required: false,
          label: 'Areas of Interest for Serving',
        },
        notes: { required: false, label: 'Additional Comments' },
      },
      // Branch-specific customizations
      customFields: branch.settings?.customFormFields || [],
    };
  }

  async deactivate(id: string): Promise<BranchDocument | null> {
    return this.branchModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();
  }
}

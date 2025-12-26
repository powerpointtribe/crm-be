import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
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

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EmailTemplate,
  EmailTemplateDocument,
  AVAILABLE_TEMPLATE_VARIABLES,
} from './schemas/email-template.schema';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto } from './dto/create-email-template.dto';
import { TemplateQueryDto } from './dto/campaign-query.dto';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  async create(
    createTemplateDto: CreateEmailTemplateDto,
    createdBy?: string,
  ): Promise<EmailTemplate> {
    // Check for duplicate name in same branch
    const existing = await this.emailTemplateModel.findOne({
      branch: createTemplateDto.branch,
      name: { $regex: new RegExp(`^${createTemplateDto.name}$`, 'i') },
    });

    if (existing) {
      throw new ConflictException('A template with this name already exists in this branch');
    }

    const template = new this.emailTemplateModel({
      ...createTemplateDto,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });

    const savedTemplate = await template.save();
    this.logger.log(`Email template created: ${savedTemplate._id}`);
    return savedTemplate;
  }

  async findAll(query: TemplateQueryDto, branchId?: string) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      module,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: any = {};

    const conditions: any[] = [];

    // Branch filter — show both branch-specific and global (system) templates
    const effectiveBranchId = query.branchId || branchId;
    if (effectiveBranchId) {
      conditions.push({
        $or: [
          { branch: new Types.ObjectId(effectiveBranchId) },
          { branch: null },
        ],
      });
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Module filter
    if (module) {
      if (module === 'uncategorized') {
        conditions.push({ $or: [{ module: null }, { module: { $exists: false } }] });
      } else {
        filter.module = module;
      }
    }

    // Active status filter (handle both boolean and string from query params)
    if (isActive !== undefined && isActive !== null) {
      filter.isActive = String(isActive) === 'true';
    }

    // Search filter
    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (conditions.length > 0) {
      filter.$and = conditions;
    }

    const total = await this.emailTemplateModel.countDocuments(filter);
    const items = await this.emailTemplateModel
      .find(filter)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: string): Promise<EmailTemplate | null> {
    return this.emailTemplateModel
      .findById(id)
      .populate('branch', 'name')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();
  }

  async update(
    id: string,
    updateTemplateDto: UpdateEmailTemplateDto,
    updatedBy?: string,
  ): Promise<EmailTemplate> {
    const template = await this.emailTemplateModel.findById(id);
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Check for duplicate name if name is being changed
    if (updateTemplateDto.name && updateTemplateDto.name !== template.name) {
      const existing = await this.emailTemplateModel.findOne({
        branch: template.branch,
        name: { $regex: new RegExp(`^${updateTemplateDto.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existing) {
        throw new ConflictException('A template with this name already exists in this branch');
      }
    }

    const updateData = {
      ...updateTemplateDto,
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
    };

    const updatedTemplate = await this.emailTemplateModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();

    if (!updatedTemplate) {
      throw new NotFoundException(`Template with ID ${id} not found after update`);
    }

    this.logger.log(`Email template updated: ${id}`);
    return updatedTemplate;
  }

  async findBySlug(slug: string): Promise<EmailTemplate | null> {
    return this.emailTemplateModel
      .findOne({ slug })
      .populate('branch', 'name')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();
  }

  async getModuleCounts(): Promise<{ module: string; count: number }[]> {
    return this.emailTemplateModel.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $project: { module: { $ifNull: ['$_id', 'uncategorized'] }, count: 1, _id: 0 } },
      { $sort: { module: 1 } },
    ]);
  }

  async remove(id: string): Promise<void> {
    const template = await this.emailTemplateModel.findById(id);
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    if (template.isSystem) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    await this.emailTemplateModel.findByIdAndDelete(id);
    this.logger.log(`Email template deleted: ${id}`);
  }

  async getActiveTemplates(branchId: string): Promise<EmailTemplate[]> {
    return this.emailTemplateModel
      .find({ branch: new Types.ObjectId(branchId), isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  async getAvailableVariables(): Promise<string[]> {
    return [...AVAILABLE_TEMPLATE_VARIABLES];
  }

  /**
   * Preview a template with sample data
   */
  async previewTemplate(id: string, sampleData?: Record<string, string>): Promise<{
    subject: string;
    htmlContent: string;
    plainTextContent?: string;
  }> {
    const template = await this.findById(id);
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Default sample data
    const defaultSampleData: Record<string, string> = {
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+2348012345678',
      branchName: 'Main Branch',
      districtName: 'District 1',
      unitName: 'Ushering Unit',
      membershipStatus: 'Member',
      dateJoined: new Date().toLocaleDateString(),
    };

    const data = { ...defaultSampleData, ...sampleData };

    // Replace variables in content
    const replaceVariables = (content: string): string => {
      return content.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return data[variable] || match;
      });
    };

    return {
      subject: replaceVariables(template.subject),
      htmlContent: replaceVariables(template.htmlContent),
      plainTextContent: template.plainTextContent
        ? replaceVariables(template.plainTextContent)
        : undefined,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FormTemplate, FormTemplateDocument } from './schemas/form-template.schema';
import { CreateFormTemplateDto, UpdateFormTemplateDto } from './dto/create-form-template.dto';

@Injectable()
export class FormTemplateService {
  constructor(
    @InjectModel(FormTemplate.name)
    private formTemplateModel: Model<FormTemplateDocument>,
  ) {}

  async create(dto: CreateFormTemplateDto, createdBy?: string): Promise<FormTemplateDocument> {
    const existing = await this.formTemplateModel.findOne({
      branch: dto.branch ? new Types.ObjectId(dto.branch) : undefined,
      name: { $regex: new RegExp(`^${dto.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      throw new ConflictException(`A form with the name "${dto.name}" already exists`);
    }

    if (dto.slug) {
      const slugExists = await this.formTemplateModel.findOne({ slug: dto.slug });
      if (slugExists) {
        throw new ConflictException(`A form with the slug "${dto.slug}" already exists`);
      }
    }

    const formData: any = {
      ...dto,
      branch: dto.branch ? new Types.ObjectId(dto.branch) : undefined,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    };

    return this.formTemplateModel.create(formData);
  }

  async findAll(
    query: {
      search?: string;
      module?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    branchId?: string,
  ) {
    const filter: any = {};
    if (branchId) {
      filter.$or = [
        { branch: new Types.ObjectId(branchId) },
        { branch: { $exists: false } },
      ];
    }
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.module) {
      filter.module = query.module;
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.formTemplateModel
        .find(filter)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.formTemplateModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<FormTemplateDocument> {
    const form = await this.formTemplateModel
      .findById(id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();
    if (!form) {
      throw new NotFoundException(`Form template with ID ${id} not found`);
    }
    return form;
  }

  async findBySlug(slug: string): Promise<FormTemplateDocument | null> {
    return this.formTemplateModel
      .findOne({ slug })
      .populate('createdBy', 'firstName lastName')
      .exec();
  }

  async getActiveForms(branchId?: string): Promise<FormTemplateDocument[]> {
    const filter: any = { isActive: true };
    if (branchId) {
      filter.$or = [
        { branch: new Types.ObjectId(branchId) },
        { branch: { $exists: false } },
      ];
    }
    return this.formTemplateModel
      .find(filter)
      .select('name slug module description fields style allowAnonymous submitButtonText')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    dto: UpdateFormTemplateDto,
    updatedBy?: string,
  ): Promise<FormTemplateDocument> {
    const existing = await this.formTemplateModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Form template with ID ${id} not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.formTemplateModel.findOne({
        _id: { $ne: id },
        branch: existing.branch,
        name: { $regex: new RegExp(`^${dto.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (duplicate) {
        throw new ConflictException(`A form with the name "${dto.name}" already exists`);
      }
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.formTemplateModel.findOne({
        _id: { $ne: id },
        slug: dto.slug,
      });
      if (slugExists) {
        throw new ConflictException(`A form with the slug "${dto.slug}" already exists`);
      }
    }

    const updateData: any = { ...dto };
    if (updatedBy) {
      updateData.updatedBy = new Types.ObjectId(updatedBy);
    }

    const updated = await this.formTemplateModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException(`Form template with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const form = await this.formTemplateModel.findById(id);
    if (!form) {
      throw new NotFoundException(`Form template with ID ${id} not found`);
    }
    if (form.isSystem) {
      throw new BadRequestException('System form templates cannot be deleted');
    }
    await this.formTemplateModel.findByIdAndDelete(id);
  }

  async getModuleCounts(): Promise<{ module: string; count: number }[]> {
    return this.formTemplateModel.aggregate([
      { $group: { _id: '$module', count: { $sum: 1 } } },
      { $project: { module: '$_id', count: 1, _id: 0 } },
      { $sort: { module: 1 } },
    ]);
  }

  async getPublicFormConfig(id: string): Promise<any> {
    const form = await this.formTemplateModel
      .findById(id)
      .select('name description fields htmlContent style submitButtonText successMessage successHeading allowAnonymous isActive')
      .lean()
      .exec();
    if (!form) {
      throw new NotFoundException('Form not found');
    }
    if (!form.isActive) {
      throw new BadRequestException('This form is not currently active');
    }
    return form;
  }
}

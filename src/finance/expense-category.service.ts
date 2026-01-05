import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExpenseCategory,
  ExpenseCategoryDocument,
} from './schemas/expense-category.schema';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-category.dto';

@Injectable()
export class ExpenseCategoryService {
  constructor(
    @InjectModel(ExpenseCategory.name)
    private expenseCategoryModel: Model<ExpenseCategoryDocument>,
  ) {}

  async create(
    dto: CreateExpenseCategoryDto,
    branchId: string,
    createdBy: string,
  ): Promise<ExpenseCategory> {
    // Check if category name already exists for this branch
    const existingCategory = await this.expenseCategoryModel.findOne({
      branch: new Types.ObjectId(branchId),
      name: dto.name,
    });

    if (existingCategory) {
      throw new BadRequestException(
        'An expense category with this name already exists',
      );
    }

    // Check if code is unique if provided
    if (dto.code) {
      const existingCode = await this.expenseCategoryModel.findOne({
        code: dto.code,
      });
      if (existingCode) {
        throw new BadRequestException('Category code already exists');
      }
    }

    const category = new this.expenseCategoryModel({
      ...dto,
      branch: new Types.ObjectId(branchId),
      createdBy: new Types.ObjectId(createdBy),
    });

    return category.save();
  }

  async findAll(branchId?: string, includeInactive = false): Promise<ExpenseCategory[]> {
    const filter: any = {};

    // Validate branchId is a valid 24-character hex string before using it
    if (branchId && /^[a-fA-F0-9]{24}$/.test(branchId)) {
      filter.branch = new Types.ObjectId(branchId);
    }

    if (!includeInactive) {
      filter.isActive = true;
    }

    return this.expenseCategoryModel
      .find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<ExpenseCategory> {
    const category = await this.expenseCategoryModel
      .findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .exec();

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    return category;
  }

  async update(
    id: string,
    dto: UpdateExpenseCategoryDto,
    updatedBy: string,
  ): Promise<ExpenseCategory> {
    const category = await this.expenseCategoryModel.findById(id);

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    // Check if name is unique within branch if changing
    if (dto.name && dto.name !== category.name) {
      const existingCategory = await this.expenseCategoryModel.findOne({
        branch: category.branch,
        name: dto.name,
        _id: { $ne: id },
      });

      if (existingCategory) {
        throw new BadRequestException(
          'An expense category with this name already exists',
        );
      }
    }

    // Check if code is unique if changing
    if (dto.code && dto.code !== category.code) {
      const existingCode = await this.expenseCategoryModel.findOne({
        code: dto.code,
        _id: { $ne: id },
      });

      if (existingCode) {
        throw new BadRequestException('Category code already exists');
      }
    }

    Object.assign(category, dto, {
      updatedBy: new Types.ObjectId(updatedBy),
      updatedAt: new Date(),
    });

    return category.save();
  }

  async remove(id: string): Promise<void> {
    const category = await this.expenseCategoryModel.findById(id);

    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    // Soft delete by setting isActive to false
    await this.expenseCategoryModel.findByIdAndUpdate(id, {
      isActive: false,
    });
  }

  async hardDelete(id: string): Promise<void> {
    const result = await this.expenseCategoryModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException('Expense category not found');
    }
  }
}

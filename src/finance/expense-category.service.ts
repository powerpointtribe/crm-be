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
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-category.dto';

// Default expense categories to seed
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Repairs and Maintenance', description: 'Equipment repairs, building maintenance, and general upkeep' },
  { name: "Lead Pastor's Welfare", description: "Expenses related to the Lead Pastor's welfare and support" },
  { name: 'Venue Expenses', description: 'Costs for venue rentals, hall bookings, and related expenses' },
  { name: 'Programme & Events', description: 'Church programs, events, and activities expenses' },
  { name: 'Missions', description: 'Mission trips, outreach programs, and evangelism expenses' },
  { name: 'Monthly Bulk Outflows', description: 'Regular monthly bulk payments and recurring expenses' },
  { name: 'Subscriptions', description: 'Software, services, and other subscription expenses' },
  { name: 'Logistics', description: 'Transportation, delivery, and logistics-related expenses' },
  { name: 'Honorarium', description: 'Guest speakers, ministers, and service honorariums' },
  { name: 'In-Reach', description: 'Internal ministry and member care initiatives' },
  { name: 'Birthdays', description: 'Birthday celebrations and related expenses' },
  { name: 'Capital Expenditure', description: 'Major equipment purchases and capital investments' },
  { name: 'Utilities', description: 'Electricity, water, internet, and other utility bills' },
  { name: 'General Welfare', description: 'Member welfare, benevolence, and support programs' },
  { name: 'Member Celebrations', description: 'Weddings, anniversaries, and member milestone celebrations' },
  { name: 'Others', description: 'Miscellaneous expenses not covered by other categories' },
];

@Injectable()
export class ExpenseCategoryService {
  constructor(
    @InjectModel(ExpenseCategory.name)
    private expenseCategoryModel: Model<ExpenseCategoryDocument>,
    @InjectModel(Branch.name)
    private branchModel: Model<BranchDocument>,
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

  /**
   * Initialize default expense categories for a branch
   */
  async initializeDefaults(
    branchId: string,
    createdBy: string,
  ): Promise<{ created: boolean; count: number }> {
    // Check if categories already exist for this branch
    const existingCount = await this.expenseCategoryModel.countDocuments({
      branch: new Types.ObjectId(branchId),
    });

    if (existingCount > 0) {
      return { created: false, count: existingCount };
    }

    // Create default categories
    const categories = DEFAULT_EXPENSE_CATEGORIES.map((cat, index) => ({
      branch: new Types.ObjectId(branchId),
      name: cat.name,
      description: cat.description,
      isActive: true,
      requiresApproval: true,
      sortOrder: index,
      createdBy: new Types.ObjectId(createdBy),
    }));

    await this.expenseCategoryModel.insertMany(categories);

    return { created: true, count: categories.length };
  }

  /**
   * Reset and reinitialize expense categories for a branch
   */
  async resetAndInitialize(
    branchId: string,
    createdBy: string,
  ): Promise<{ count: number }> {
    // Delete all existing categories for this branch
    await this.expenseCategoryModel.deleteMany({
      branch: new Types.ObjectId(branchId),
    });

    // Create default categories
    const categories = DEFAULT_EXPENSE_CATEGORIES.map((cat, index) => ({
      branch: new Types.ObjectId(branchId),
      name: cat.name,
      description: cat.description,
      isActive: true,
      requiresApproval: true,
      sortOrder: index,
      createdBy: new Types.ObjectId(createdBy),
    }));

    await this.expenseCategoryModel.insertMany(categories);

    return { count: categories.length };
  }

  /**
   * Find expense categories by branch slug (for public endpoints)
   */
  async findByBranchSlug(branchSlug: string): Promise<ExpenseCategory[]> {
    // Find branch by slug
    const branch = await this.branchModel.findOne({
      slug: branchSlug.toLowerCase(),
      isActive: true,
    });

    if (!branch) {
      throw new NotFoundException(`Campus with slug "${branchSlug}" not found`);
    }

    return this.expenseCategoryModel
      .find({
        branch: branch._id,
        isActive: true,
      })
      .select('_id name description')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }
}

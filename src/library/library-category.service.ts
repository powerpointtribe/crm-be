import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookCategory, BookCategoryDocument } from './schemas/book-category.schema';
import { CreateBookCategoryDto, UpdateBookCategoryDto } from './dto/create-book-category.dto';
import { CategoryQueryDto } from './dto/library-query.dto';

@Injectable()
export class LibraryCategoryService {
  private readonly logger = new Logger(LibraryCategoryService.name);

  constructor(
    @InjectModel(BookCategory.name)
    private bookCategoryModel: Model<BookCategoryDocument>,
  ) {}

  async create(
    createCategoryDto: CreateBookCategoryDto,
    createdBy?: string,
  ): Promise<BookCategory> {
    // Check for duplicate name in same branch
    const existing = await this.bookCategoryModel.findOne({
      branch: createCategoryDto.branch,
      name: { $regex: new RegExp(`^${createCategoryDto.name}$`, 'i') },
    });

    if (existing) {
      throw new ConflictException('A category with this name already exists in this branch');
    }

    const category = new this.bookCategoryModel({
      ...createCategoryDto,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });

    const savedCategory = await category.save();
    this.logger.log(`Category created: ${savedCategory._id}`);
    return savedCategory;
  }

  async findAll(query: CategoryQueryDto, branchId?: string) {
    const { page = 1, limit = 50, search, isActive, sortBy = 'sortOrder', sortOrder = 'asc' } = query;

    const filter: any = {};

    // Branch filter
    const effectiveBranchId = query.branchId || branchId;
    if (effectiveBranchId) {
      filter.branch = new Types.ObjectId(effectiveBranchId);
    }

    // Active status filter
    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await this.bookCategoryModel.countDocuments(filter);
    const items = await this.bookCategoryModel
      .find(filter)
      .populate('createdBy', 'firstName lastName')
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

  async findById(id: string): Promise<BookCategory | null> {
    return this.bookCategoryModel
      .findById(id)
      .populate('createdBy', 'firstName lastName')
      .exec();
  }

  async update(id: string, updateCategoryDto: UpdateBookCategoryDto): Promise<BookCategory> {
    const category = await this.bookCategoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check for duplicate name if name is being changed
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existing = await this.bookCategoryModel.findOne({
        branch: category.branch,
        name: { $regex: new RegExp(`^${updateCategoryDto.name}$`, 'i') },
        _id: { $ne: id },
      });

      if (existing) {
        throw new ConflictException('A category with this name already exists in this branch');
      }
    }

    const updatedCategory = await this.bookCategoryModel
      .findByIdAndUpdate(id, { $set: updateCategoryDto }, { new: true })
      .populate('createdBy', 'firstName lastName')
      .exec();

    if (!updatedCategory) {
      throw new NotFoundException(`Category with ID ${id} not found after update`);
    }

    this.logger.log(`Category updated: ${id}`);
    return updatedCategory;
  }

  async remove(id: string): Promise<void> {
    const category = await this.bookCategoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.bookCategoryModel.findByIdAndDelete(id);
    this.logger.log(`Category deleted: ${id}`);
  }

  async getActiveCategories(branchId: string): Promise<BookCategory[]> {
    return this.bookCategoryModel
      .find({ branch: new Types.ObjectId(branchId), isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }
}

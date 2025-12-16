import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InventoryCategory,
  InventoryCategoryDocument,
} from './schemas/inventory-category.schema';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';

@Injectable()
export class InventoryCategoryService {
  constructor(
    @InjectModel(InventoryCategory.name)
    private inventoryCategoryModel: Model<InventoryCategoryDocument>,
  ) {}

  async create(
    createInventoryCategoryDto: CreateInventoryCategoryDto,
    createdBy: string,
  ): Promise<InventoryCategory> {
    const existingCategory = await this.inventoryCategoryModel.findOne({
      code: createInventoryCategoryDto.code,
    });

    if (existingCategory) {
      throw new BadRequestException('Category code already exists');
    }

    const category = new this.inventoryCategoryModel({
      ...createInventoryCategoryDto,
      createdBy,
    });

    return category.save();
  }

  async findAll(): Promise<InventoryCategory[]> {
    return this.inventoryCategoryModel
      .find({ isActive: true })
      .populate('parentCategory', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .sort({ sortOrder: 1, name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<InventoryCategory> {
    const category = await this.inventoryCategoryModel
      .findById(id)
      .populate('parentCategory', 'name code')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    id: string,
    updateData: Partial<CreateInventoryCategoryDto>,
    updatedBy: string,
  ): Promise<InventoryCategory> {
    const category = await this.inventoryCategoryModel.findById(id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (updateData.code && updateData.code !== category.code) {
      const existingCategory = await this.inventoryCategoryModel.findOne({
        code: updateData.code,
        _id: { $ne: id },
      });

      if (existingCategory) {
        throw new BadRequestException('Category code already exists');
      }
    }

    Object.assign(category, updateData, { updatedBy, updatedAt: new Date() });
    return category.save();
  }

  async remove(id: string): Promise<void> {
    const category = await this.inventoryCategoryModel.findById(id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.inventoryCategoryModel.findByIdAndUpdate(id, {
      isActive: false,
    });
  }

  async getHierarchy(): Promise<any[]> {
    const categories = await this.inventoryCategoryModel
      .find({ isActive: true })
      .populate('parentCategory', 'name code')
      .sort({ sortOrder: 1, name: 1 })
      .exec();

    const categoryMap = new Map<string, any>();
    const rootCategories: any[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat._id.toString(), { ...cat.toObject(), children: [] });
    });

    categories.forEach((cat) => {
      const categoryObj = categoryMap.get(cat._id.toString());
      if (cat.parentCategory) {
        const parent = categoryMap.get(
          (cat.parentCategory as any)._id.toString(),
        );
        if (parent) {
          parent.children.push(categoryObj);
        }
      } else {
        rootCategories.push(categoryObj);
      }
    });

    return rootCategories;
  }
}

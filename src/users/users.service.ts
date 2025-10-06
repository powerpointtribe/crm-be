import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkUserOperationDto, BulkUserResultDto } from './dto/bulk-user.dto';
import { SearchDto } from '../common/dto/search.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { BulkOperationUtil } from '../common/utils/bulk-operation.util';
import { BulkOperationType } from '../common/interfaces/bulk-operation.interface';
import { UserCSVMappingUtil } from './utils/user-csv-mapping.util';
import { UserRole } from '../common/enums/user-roles.enums';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async findAll(searchDto: SearchDto): Promise<PaginatedResult<UserDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = searchDto;
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery: any = {};
    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort query
    const sortQuery: any = {};
    sortQuery[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute queries
    const [users, total] = await Promise.all([
      this.userModel
        .find(searchQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .select('-password')
        .exec(),
      this.userModel.countDocuments(searchQuery),
    ]);

    return createPaginatedResult(users, total, page, limit);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('-password');
  }

  async findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role, isActive: true }).select('-password');
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: updateUserDto },
        { new: true, runValidators: true },
      )
      .select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: id },
      { $set: { password: hashedPassword } },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: id },
      { $set: { lastLogin: new Date() } },
    );
  }

  async deactivate(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
      .select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async activate(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: { isActive: true } }, { new: true })
      .select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async getUserStats(): Promise<any> {
    const stats = await this.userModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' },
          roles: {
            $push: {
              role: '$_id',
              count: '$count',
            },
          },
        },
      },
    ]);

    const activeUsers = await this.userModel.countDocuments({ isActive: true });
    const inactiveUsers = await this.userModel.countDocuments({
      isActive: false,
    });

    return {
      total: stats[0]?.total || 0,
      active: activeUsers,
      inactive: inactiveUsers,
      byRole: stats[0]?.roles || [],
    };
  }

  async bulkOperation(
    csvContent: string,
    options: BulkUserOperationDto,
  ): Promise<BulkUserResultDto> {
    const {
      operationType,
      identifierField = 'email',
      defaultPassword,
      defaultRole,
      ...bulkOptions
    } = options;

    // Determine mapping configuration based on operation type
    const mappingConfig =
      operationType === BulkOperationType.CREATE
        ? UserCSVMappingUtil.getCreateMappingConfig()
        : UserCSVMappingUtil.getUpdateMappingConfig();

    // Set up default values
    const defaultValues: any = {};
    if (defaultPassword && operationType === BulkOperationType.CREATE) {
      defaultValues.password = defaultPassword;
    }
    if (defaultRole) defaultValues.role = defaultRole;

    const result = await BulkOperationUtil.processBulkOperation(
      csvContent,
      operationType === BulkOperationType.CREATE
        ? CreateUserDto
        : UpdateUserDto,
      mappingConfig,
      (dto: CreateUserDto) => this.createSafe(dto),
      (identifier: any, dto: Partial<UpdateUserDto>) =>
        this.updateSafe(identifier, dto),
      (identifier: any) => this.findByIdentifier(identifier, identifierField),
      {
        ...bulkOptions,
        operationType,
        identifierField,
        defaultValues,
      },
    );

    return {
      ...result,
      successfulRecords: result.successfulRecords,
    };
  }

  private async createSafe(
    createUserDto: CreateUserDto,
  ): Promise<UserDocument> {
    // Check if email already exists
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email.toLowerCase(),
    });
    if (existingUser) {
      throw new Error(`Email ${createUserDto.email} already registered`);
    }

    const user = new this.userModel({
      ...createUserDto,
      email: createUserDto.email.toLowerCase(),
      role: createUserDto.role || UserRole.MEMBER,
      isActive:
        createUserDto.isActive !== undefined ? createUserDto.isActive : true,
    });

    return user.save();
  }

  private async updateSafe(
    identifier: any,
    updateUserDto: Partial<UpdateUserDto> | any, // Allow any for bulk operations
  ): Promise<UserDocument> {
    // If email is being updated (for bulk operations), check for conflicts
    if (updateUserDto.email) {
      const existingUser = await this.userModel.findOne({
        email: updateUserDto.email.toLowerCase(),
        _id: { $ne: identifier }, // Exclude current user
      });
      if (existingUser) {
        throw new Error(`Email ${updateUserDto.email} already registered`);
      }
      updateUserDto.email = updateUserDto.email.toLowerCase();
    }

    const user = await this.userModel.findOneAndUpdate(
      { email: identifier },
      { $set: updateUserDto },
      { new: true, runValidators: true },
    );

    if (!user) {
      throw new Error(`User with ${identifier} not found`);
    }

    return user;
  }

  private async findByIdentifier(
    identifier: any,
    identifierField: string,
  ): Promise<UserDocument | null> {
    const query: any = {};
    query[identifierField] = identifier;

    return this.userModel.findOne(query);
  }

  generateUserCSVTemplate(operationType: 'create' | 'update'): string {
    return UserCSVMappingUtil.generateSampleCSV(operationType);
  }
}

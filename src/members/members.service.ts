import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Member, MemberDocument } from './schemas/member.schema';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberSearchDto } from './dto/member-search.dto';
import {
  BulkMemberOperationDto,
  BulkMemberResultDto,
} from './dto/bulk-member.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import { BulkOperationUtil } from '../common/utils/bulk-operation.util';
import { BulkOperationType } from '../common/interfaces/bulk-operation.interface';
import { MemberCSVMappingUtil } from './utils/member-csv-mapping.util';
import { MembershipStatus } from '../common/enums/member-status.enum';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';
import { RolesService } from '../roles/services/roles.service';

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private branchAccessService: BranchAccessService,
    @Inject(forwardRef(() => RolesService))
    private rolesService: RolesService,
  ) {}

  async create(createMemberDto: CreateMemberDto): Promise<MemberDocument> {
    // District assignment is now optional
    // Members can be created without district assignment and assigned later

    // Check for exact duplicate (all four fields must match)
    await this.checkForExactDuplicate(
      createMemberDto.firstName,
      createMemberDto.lastName,
      createMemberDto.email,
      createMemberDto.phone,
    );

    // Validate and convert dateOfBirth
    const dateOfBirth = new Date(createMemberDto.dateOfBirth);
    if (isNaN(dateOfBirth.getTime())) {
      throw new BadRequestException(
        'Invalid date format for dateOfBirth. Use YYYY-MM-DD format.',
      );
    }

    // TODO: Add validation to ensure district exists and is of type 'district'
    // TODO: Add validation to ensure unit (if provided) exists and is of type 'unit'

    const member = new this.memberModel({
      ...createMemberDto,
      email: createMemberDto.email.toLowerCase(),
      dateOfBirth,
      dateJoined: createMemberDto.dateJoined
        ? new Date(createMemberDto.dateJoined)
        : new Date(),
      address: createMemberDto.address
        ? {
            ...createMemberDto.address,
            state: createMemberDto.address.state || 'Lagos',
            country: createMemberDto.address.country || 'Nigeria',
          }
        : {
            street: '',
            city: '',
            state: 'Lagos',
            country: 'Nigeria',
          },
    });

    return member.save();
  }

  // Duplicate checking methods

  /**
   * Check for exact duplicate - only rejects if ALL four fields match
   */
  async checkForExactDuplicate(
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
  ): Promise<void> {
    const existingMember = await this.findExactDuplicate(
      firstName,
      lastName,
      email,
      phone,
    );

    if (existingMember) {
      throw new BadRequestException({
        message: 'A member with the same name, email, and phone already exists',
        duplicate: {
          id: existingMember._id,
          name: `${existingMember.firstName} ${existingMember.lastName}`,
          email: existingMember.email,
          phone: existingMember.phone,
          membershipStatus: existingMember.membershipStatus,
          dateJoined: existingMember.dateJoined,
        },
        suggestion: 'Please review the existing record or update it instead',
      });
    }
  }

  /**
   * Find exact duplicate by firstName, lastName, email, AND phone (all must match)
   */
  async findExactDuplicate(
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
  ): Promise<MemberDocument | null> {
    return this.memberModel
      .findOne({
        firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
        lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
        email: email?.toLowerCase(),
        phone: phone,
        isActive: true,
      })
      .select('firstName lastName email phone membershipStatus dateJoined')
      .exec();
  }

  /**
   * @deprecated Use checkForExactDuplicate instead
   */
  async checkForDuplicates(email: string, phone: string): Promise<void> {
    const existingMembers = await this.findDuplicates(email, phone);

    if (existingMembers.length > 0) {
      const duplicateInfo = existingMembers.map((member) => {
        const duplicateFields: string[] = [];
        if (member.email === email.toLowerCase()) duplicateFields.push('email');
        if (member.phone === phone) duplicateFields.push('phone');

        return {
          id: member._id,
          name: `${member.firstName} ${member.lastName}`,
          duplicateFields,
          membershipStatus: member.membershipStatus,
          dateJoined: member.dateJoined,
        };
      });

      throw new BadRequestException({
        message: 'Duplicate data found',
        duplicates: duplicateInfo,
        suggestion:
          'Please review existing records or update them instead of creating new ones',
      });
    }
  }

  async findDuplicates(
    email?: string,
    phone?: string,
  ): Promise<MemberDocument[]> {
    const query = { isActive: true };
    const orConditions: any[] = [];

    if (email) {
      orConditions.push({ email: email.toLowerCase() });
    }

    if (phone) {
      orConditions.push({ phone: phone });
    }

    if (orConditions.length > 0) {
      (query as any).$or = orConditions;
    } else {
      return [];
    }

    return this.memberModel
      .find(query)
      .select('firstName lastName email phone membershipStatus dateJoined')
      .exec();
  }

  async findPotentialDuplicates(): Promise<{
    emailDuplicates: any[];
    phoneDuplicates: any[];
    nameDuplicates: any[];
  }> {
    // Find email duplicates
    const emailDuplicates = await this.memberModel.aggregate([
      { $match: { isActive: true, email: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          members: { $push: '$$ROOT' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $project: {
          email: '$_id',
          count: 1,
          members: {
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1,
            membershipStatus: 1,
            dateJoined: 1,
          },
        },
      },
    ]);

    // Find phone duplicates
    const phoneDuplicates = await this.memberModel.aggregate([
      { $match: { isActive: true, phone: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$phone',
          count: { $sum: 1 },
          members: { $push: '$$ROOT' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $project: {
          phone: '$_id',
          count: 1,
          members: {
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1,
            membershipStatus: 1,
            dateJoined: 1,
          },
        },
      },
    ]);

    // Find potential name duplicates (same first and last name)
    const nameDuplicates = await this.memberModel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            firstName: { $toLower: '$firstName' },
            lastName: { $toLower: '$lastName' },
          },
          count: { $sum: 1 },
          members: { $push: '$$ROOT' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $project: {
          name: { $concat: ['$_id.firstName', ' ', '$_id.lastName'] },
          count: 1,
          members: {
            firstName: 1,
            lastName: 1,
            email: 1,
            phone: 1,
            membershipStatus: 1,
            dateJoined: 1,
            dateOfBirth: 1,
          },
        },
      },
    ]);

    return {
      emailDuplicates,
      phoneDuplicates,
      nameDuplicates,
    };
  }

  async mergeMemberRecords(
    primaryMemberId: string,
    duplicateMemberIds: string[],
  ): Promise<MemberDocument> {
    const primaryMember = await this.findById(primaryMemberId);
    if (!primaryMember) {
      throw new NotFoundException('Primary member not found');
    }

    const duplicateMembers = await this.memberModel.find({
      _id: { $in: duplicateMemberIds },
      isActive: true,
    });

    if (duplicateMembers.length !== duplicateMemberIds.length) {
      throw new BadRequestException('Some duplicate members not found');
    }

    // Merge data from duplicate records to primary record
    const mergeData: any = {};

    // Collect all unique ministries, skills, and additional groups
    const allMinistries = new Set(primaryMember.ministries || []);
    const allSkills = new Set(primaryMember.skills || []);
    const allAdditionalGroups = new Set(
      primaryMember.additionalGroups?.map((id) => id.toString()) || [],
    );

    duplicateMembers.forEach((duplicate) => {
      duplicate.ministries?.forEach((ministry) => allMinistries.add(ministry));
      duplicate.skills?.forEach((skill) => allSkills.add(skill));
      duplicate.additionalGroups?.forEach((group) =>
        allAdditionalGroups.add(group.toString()),
      );
    });

    mergeData.ministries = Array.from(allMinistries);
    mergeData.skills = Array.from(allSkills);
    mergeData.additionalGroups = Array.from(allAdditionalGroups).map(
      (id) => new Types.ObjectId(id),
    );

    // Update primary member with merged data
    await this.memberModel.findByIdAndUpdate(
      primaryMemberId,
      { $set: mergeData },
      { new: true },
    );

    // Deactivate duplicate members with merge notes
    await this.memberModel.updateMany(
      { _id: { $in: duplicateMemberIds } },
      {
        $set: {
          isActive: false,
          notes: `Merged with member ${primaryMemberId} on ${new Date().toISOString()}`,
        },
      },
    );

    const mergedMember = await this.findById(primaryMemberId);
    if (!mergedMember) {
      throw new NotFoundException('Primary member not found after merge operation');
    }
    return mergedMember;
  }

  async findAll(
    searchDto: MemberSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<MemberDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      membershipStatus,
      gender,
      maritalStatus,
      districtId,
      unitId,
      ministry,
      dateJoinedFrom,
      dateJoinedTo,
      minAge,
      maxAge,
      branchId,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<MemberDocument> = { isActive: true };

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
      // Override branchId from query if user has view-all permission and specified one
      const effectiveContext: BranchFilterContext = {
        ...branchFilterContext,
        selectedBranchId: branchId || branchFilterContext.selectedBranchId,
      };
      filterQuery = this.branchAccessService.applyBranchFilter(
        filterQuery,
        effectiveContext,
        'branch',
      );
    }

    // Text search
    if (search) {
      const searchQuery = QueryBuilder.buildSearchQuery(search, [
        'firstName',
        'lastName',
        'email',
        'phone',
        'occupation',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Status filters
    if (membershipStatus) filterQuery.membershipStatus = membershipStatus;
    if (gender) filterQuery.gender = gender;
    if (maritalStatus) filterQuery.maritalStatus = maritalStatus;

    // Church structure filters
    if (districtId) filterQuery.district = districtId;
    if (unitId) filterQuery.unit = unitId;

    // Ministry filter
    if (ministry) filterQuery.ministries = { $in: [ministry] };

    // Date range filter
    if (dateJoinedFrom || dateJoinedTo) {
      const dateQuery = QueryBuilder.buildDateRangeQuery(
        dateJoinedFrom,
        dateJoinedTo,
        'dateJoined',
      );
      Object.assign(filterQuery, dateQuery);
    }

    // Age range filter
    if (minAge !== undefined || maxAge !== undefined) {
      const today = new Date();
      const ageQuery: any = {};

      if (maxAge !== undefined) {
        const minBirthDate = new Date(
          today.getFullYear() - maxAge - 1,
          today.getMonth(),
          today.getDate(),
        );
        ageQuery.$gte = minBirthDate;
      }

      if (minAge !== undefined) {
        const maxBirthDate = new Date(
          today.getFullYear() - minAge,
          today.getMonth(),
          today.getDate(),
        );
        ageQuery.$lte = maxBirthDate;
      }

      filterQuery.dateOfBirth = ageQuery;
    }

    // Build sort query
    const sortQuery = QueryBuilder.buildSortQuery(sortBy, sortOrder);

    // Execute queries with proper population
    // Note: Using lean() with manual population to handle invalid ObjectId references gracefully
    const [members, total] = await Promise.all([
      this.memberModel
        .find(filterQuery)
        .populate({
          path: 'branch',
          select: '_id name',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'district',
          select: '_id name type branch',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'unit',
          select: '_id name type branch',
          options: { strictPopulate: false }
        })
        .populate('spouse', 'firstName lastName')
        .populate('children', 'firstName lastName')
        .populate('parent', 'firstName lastName')
        .populate('additionalGroups', 'name type')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments(filterQuery),
    ]);

    // Filter out or clean members with invalid district/unit references
    const cleanedMembers = members.map(member => {
      const memberObj = member.toObject();

      // If district is not a valid populated object, set it to undefined
      if (memberObj.district && typeof memberObj.district === 'string') {
        delete memberObj.district;
      }

      // If unit is not a valid populated object, set it to undefined
      if (memberObj.unit && typeof memberObj.unit === 'string') {
        delete memberObj.unit;
      }

      return memberObj;
    });

    return createPaginatedResult(cleanedMembers as any, total, page, limit);
  }

  async findById(id: string): Promise<MemberDocument | null> {
    return this.memberModel
      .findById(id)
      .populate('role')
      .populate('branch', '_id name')
      .populate('district', '_id name type description meetingSchedule branch')
      .populate('unit', '_id name type description branch')
      .populate('spouse', 'firstName lastName email phone')
      .populate('children', 'firstName lastName email phone dateOfBirth')
      .populate('parent', 'firstName lastName email phone')
      .populate('additionalGroups', 'name type description')
      .exec();
  }

  async findByUserId(userId: string): Promise<MemberDocument | null> {
    // Since users are now represented by members, userId is the memberId
    return this.memberModel.findById(userId).exec();
  }

  async findByEmail(email: string): Promise<MemberDocument | null> {
    return this.memberModel
      .findOne({ email: email.toLowerCase(), isActive: true })
      .populate('role')
      .populate('district', 'name type')
      .populate('unit', 'name type')
      .exec();
  }

  async update(
    id: string,
    updateMemberDto: UpdateMemberDto,
  ): Promise<MemberDocument> {
    // Check for duplicates when updating email or phone
    if (updateMemberDto.email || updateMemberDto.phone) {
      await this.checkForDuplicatesExcludingMember(
        id,
        updateMemberDto.email,
        updateMemberDto.phone,
      );
    }

    // Normalize email if provided
    if (updateMemberDto.email) {
      updateMemberDto.email = updateMemberDto.email.toLowerCase();
    }

    const member = await this.memberModel
      .findByIdAndUpdate(
        id,
        { $set: updateMemberDto },
        { new: true, runValidators: true },
      )
      .populate('district', 'name type')
      .populate('unit', 'name type')
      .exec();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  private async checkForDuplicatesExcludingMember(
    excludeMemberId: string,
    email?: string,
    phone?: string,
  ): Promise<void> {
    if (!email && !phone) return;

    const query: any = {
      isActive: true,
      _id: { $ne: excludeMemberId },
    };

    const orConditions: any[] = [];
    if (email) orConditions.push({ email: email.toLowerCase() });
    if (phone) orConditions.push({ phone: phone });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    const existingMembers = await this.memberModel
      .find(query)
      .select('firstName lastName email phone membershipStatus dateJoined')
      .exec();

    if (existingMembers.length > 0) {
      const duplicateInfo = existingMembers.map((member) => {
        const duplicateFields: string[] = [];
        if (email && member.email === email.toLowerCase())
          duplicateFields.push('email');
        if (phone && member.phone === phone) duplicateFields.push('phone');

        return {
          id: member._id,
          name: `${member.firstName} ${member.lastName}`,
          duplicateFields,
          membershipStatus: member.membershipStatus,
          dateJoined: member.dateJoined,
        };
      });

      throw new BadRequestException({
        message: 'Duplicate data found',
        duplicates: duplicateInfo,
        suggestion: 'Please review existing records or merge them instead',
      });
    }
  }

  // District and Unit Management
  async assignToDistrict(
    memberId: string,
    districtId: string,
  ): Promise<MemberDocument> {
    // TODO: Validate that districtId is a valid district
    const member = await this.memberModel
      .findByIdAndUpdate(
        memberId,
        { $set: { district: districtId } },
        { new: true },
      )
      .populate('district', 'name type');

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async assignToUnit(
    memberId: string,
    unitId: string,
  ): Promise<MemberDocument> {
    // TODO: Validate that unitId is a valid unit
    const member = await this.memberModel
      .findByIdAndUpdate(memberId, { $set: { unit: unitId } }, { new: true })
      .populate('unit', 'name type');

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async removeFromUnit(memberId: string): Promise<MemberDocument> {
    const member = await this.memberModel.findByIdAndUpdate(
      memberId,
      { $unset: { unit: 1 } },
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  // Analytics and Reports
  async getMemberStats(
    branchFilterContext?: BranchFilterContext,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any> {
    // Build base filter with branch filtering
    let baseFilter: any = { isActive: true };

    if (branchFilterContext) {
      const branchFilter = this.branchAccessService.getBranchFilter(branchFilterContext);
      if (branchFilter.shouldFilter && branchFilter.branchId) {
        const branchIdString = branchFilter.branchId.toString();
        // Match both ObjectId and string representations
        baseFilter.branch = { $in: [branchFilter.branchId, branchIdString] };
      }
    }

    // Add date range filter for dateJoined
    if (dateFrom || dateTo) {
      baseFilter.dateJoined = {};
      if (dateFrom) {
        baseFilter.dateJoined.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 1 day to include the end date fully
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        baseFilter.dateJoined.$lte = endDate;
      }
    }

    const [
      statusStats,
      genderStats,
      districtStats,
      unitStats,
      ageStats,
      totalMembers,
    ] = await Promise.all([
      // Status distribution
      this.memberModel.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$membershipStatus', count: { $sum: 1 } } },
      ]),

      // Gender distribution
      this.memberModel.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]),

      // District distribution
      this.memberModel.aggregate([
        { $match: { ...baseFilter, district: { $exists: true, $ne: null } } },
        {
          $addFields: {
            districtObjectId: { $toObjectId: '$district' },
          },
        },
        {
          $lookup: {
            from: 'groups',
            localField: 'districtObjectId',
            foreignField: '_id',
            as: 'districtInfo',
          },
        },
        { $unwind: { path: '$districtInfo', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$districtInfo.name',
            count: { $sum: 1 },
            districtId: { $first: '$district' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 }, // Limit to top 20 districts
      ]),

      // Unit distribution
      this.memberModel.aggregate([
        { $match: { ...baseFilter, unit: { $exists: true, $ne: null } } },
        {
          $addFields: {
            unitObjectId: { $toObjectId: '$unit' },
          },
        },
        {
          $lookup: {
            from: 'groups',
            localField: 'unitObjectId',
            foreignField: '_id',
            as: 'unitInfo',
          },
        },
        { $unwind: '$unitInfo' },
        {
          $group: {
            _id: '$unitInfo.name',
            count: { $sum: 1 },
            unitId: { $first: '$unit' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Age distribution
      this.memberModel.aggregate([
        { $match: baseFilter },
        {
          $project: {
            age: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$dateOfBirth'] },
                  31557600000, // milliseconds in a year
                ],
              },
            },
          },
        },
        {
          $bucket: {
            groupBy: '$age',
            boundaries: [0, 18, 30, 45, 60, 100],
            default: 'Unknown',
            output: { count: { $sum: 1 } },
          },
        },
      ]),

      // Total count
      this.memberModel.countDocuments(baseFilter),
    ]);

    const membersWithoutUnits = await this.memberModel.countDocuments({
      ...baseFilter,
      $or: [{ unit: null }, { unit: { $exists: false } }],
    });

    return {
      total: totalMembers,
      byStatus: statusStats,
      byGender: genderStats,
      byDistrict: districtStats,
      byUnit: unitStats,
      byAge: ageStats,
      membersWithoutUnits,
      unitAssignmentRate:
        totalMembers > 0
          ? Math.round(
              ((totalMembers - membersWithoutUnits) / totalMembers) * 100,
            )
          : 0,
    };
  }

  async getDistrictMembers(districtId: string): Promise<MemberDocument[]> {
    return this.memberModel
      .find({ district: districtId, isActive: true })
      .sort({ firstName: 1, lastName: 1 });
  }

  async getUnitMembers(unitId: string): Promise<MemberDocument[]> {
    return this.memberModel
      .find({ unit: unitId, isActive: true })
      .sort({ firstName: 1, lastName: 1 });
  }

  async getNewMembersThisMonth(): Promise<MemberDocument[]> {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    return this.memberModel
      .find({
        dateJoined: { $gte: startOfMonth },
        isActive: true,
      })
      .populate('district', 'name')
      .populate('unit', 'name')
      .sort({ dateJoined: -1 })
      .limit(20);
  }

  async getBirthdaysThisWeek(): Promise<MemberDocument[]> {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.memberModel.aggregate([
      {
        $addFields: {
          birthdayThisYear: {
            $dateFromParts: {
              year: today.getFullYear(),
              month: { $month: '$dateOfBirth' },
              day: { $dayOfMonth: '$dateOfBirth' },
            },
          },
        },
      },
      {
        $match: {
          birthdayThisYear: {
            $gte: today,
            $lte: nextWeek,
          },
          isActive: true,
        },
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'district',
          foreignField: '_id',
          as: 'district',
        },
      },
      {
        $sort: { birthdayThisYear: 1 },
      },
    ]);
  }

  async deactivate(id: string): Promise<MemberDocument> {
    const member = await this.memberModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async activate(id: string): Promise<MemberDocument> {
    const member = await this.memberModel.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async remove(id: string): Promise<void> {
    const result = await this.memberModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Member not found');
    }
  }

  async searchMembers(query: string): Promise<MemberDocument[]> {
    const searchRegex = new RegExp(query, 'i');

    return this.memberModel
      .find({
        $or: [
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phone: { $regex: searchRegex } },
        ],
        isActive: true,
      })
      .populate('district', 'name')
      .populate('unit', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('firstName lastName email phone membershipStatus district unit')
      .exec();
  }

  async bulkOperation(
    csvContent: string,
    options: BulkMemberOperationDto,
  ): Promise<BulkMemberResultDto> {
    const {
      operationType,
      identifierField = 'email',
      defaultDistrict,
      defaultUnit,
      ...bulkOptions
    } = options;

    // Determine mapping configuration based on operation type
    const mappingConfig =
      operationType === BulkOperationType.CREATE
        ? MemberCSVMappingUtil.getCreateMappingConfig()
        : MemberCSVMappingUtil.getUpdateMappingConfig();

    // Set up default values
    const defaultValues: any = {};
    if (defaultDistrict) defaultValues.district = defaultDistrict;
    if (defaultUnit) defaultValues.unit = defaultUnit;

    const result = await BulkOperationUtil.processBulkOperation(
      csvContent,
      operationType === BulkOperationType.CREATE
        ? CreateMemberDto
        : UpdateMemberDto,
      mappingConfig,
      (dto: CreateMemberDto) => this.createSafe(dto),
      (identifier: any, dto: Partial<UpdateMemberDto>) =>
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
    createMemberDto: CreateMemberDto,
  ): Promise<MemberDocument> {
    // Process nested objects
    const processedDto =
      MemberCSVMappingUtil.postProcessMappedData(createMemberDto);

    // Check for exact duplicates in bulk operations (all four fields must match)
    try {
      await this.checkForExactDuplicate(
        processedDto.firstName,
        processedDto.lastName,
        processedDto.email,
        processedDto.phone,
      );
    } catch (error) {
      // For bulk operations, we'll log duplicates but continue processing
      throw new Error(`Duplicate found: ${error.message}`);
    }

    // Validate district assignment
    if (!processedDto.district) {
      throw new Error('Every member must be assigned to a district');
    }

    const member = new this.memberModel({
      ...processedDto,
      email: processedDto.email.toLowerCase(),
      membershipStatus:
        processedDto.membershipStatus || MembershipStatus.MEMBER,
      dateJoined: processedDto.dateJoined || new Date(),
      familyMembers: processedDto.familyMembers || [],
      ministries: processedDto.ministries || [],
      skills: processedDto.skills || [],
      additionalGroups: processedDto.additionalGroups || [],
      children: processedDto.children || [],
      isActive: true,
    });

    return member.save();
  }

  private async updateSafe(
    identifier: any,
    updateMemberDto: Partial<UpdateMemberDto>,
  ): Promise<MemberDocument> {
    // Process nested objects
    const processedDto =
      MemberCSVMappingUtil.postProcessMappedData(updateMemberDto);

    // Normalize email if provided
    if (processedDto.email) {
      processedDto.email = processedDto.email.toLowerCase();
    }

    const member = await this.memberModel.findOneAndUpdate(
      { email: identifier },
      { $set: processedDto },
      { new: true, runValidators: true },
    );

    if (!member) {
      throw new Error(`Member with ${identifier} not found`);
    }

    return member;
  }

  private async findByIdentifier(
    identifier: any,
    identifierField: string,
  ): Promise<MemberDocument | null> {
    const query: any = {};
    query[identifierField] = identifier;

    return this.memberModel.findOne(query);
  }

  generateMemberCSVTemplate(operationType: 'create' | 'update'): string {
    return MemberCSVMappingUtil.generateSampleCSV(operationType);
  }

  async updateLastLogin(memberId: string): Promise<MemberDocument> {
    const member = await this.memberModel.findByIdAndUpdate(
      memberId,
      { $set: { lastLogin: new Date() } },
      { new: true },
    );

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    return member;
  }

  async updateAccessFields(
    memberId: string,
    updateData: {
      systemRoles?: string[];
      unitType?: string;
      unit?: string;
      district?: string;
    },
  ): Promise<MemberDocument> {
    const member = await this.memberModel.findById(memberId);

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // --- Update system roles ---
    if (updateData.systemRoles) {
      member.systemRoles = updateData.systemRoles as any;
    }

    // --- Update structure fields (district/unit/unitType) ---
    if (updateData.unitType) {
      member.unitType = updateData.unitType as any;
    }
    if (updateData.unit) {
      member.unit = new Types.ObjectId(updateData.unit);
    }
    if (updateData.district) {
      member.district = new Types.ObjectId(updateData.district);
    }

    await member.save();
    return member;
  }

  /**
   * Assign a single role to a member (NEW PERMISSION SYSTEM)
   * Also updates the member's membershipStatus based on the role's membershipStatusTag
   */
  async assignRole(memberId: string, roleId: string): Promise<MemberDocument> {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member ID');
    }

    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID');
    }

    const member = await this.memberModel.findById(memberId);

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    // Fetch the role to check for membershipStatusTag
    const role = await this.rolesService.findById(roleId, false);

    member.role = new Types.ObjectId(roleId);

    // If the role has a membershipStatusTag, update the member's membershipStatus
    if (role.membershipStatusTag) {
      member.membershipStatus = role.membershipStatusTag;
    }

    await member.save();

    const updatedMember = await this.findById(memberId); // Return with populated role

    if (!updatedMember) {
      throw new NotFoundException(`Member with ID ${memberId} not found after update`);
    }

    return updatedMember;
  }

  // PASSWORD RESET METHODS
  async setPasswordResetOtp(email: string, otp: string): Promise<void> {
    try {
      const member = await this.memberModel.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      if (!member) {
        throw new NotFoundException('Member not found');
      }

      // Set OTP to expire in 15 minutes
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + 15);

      // Use updateOne to bypass validation issues with members that might not have passwords
      const result = await this.memberModel.updateOne(
        { _id: member._id },
        {
          $set: {
            resetPasswordOtp: otp,
            resetPasswordOtpExpires: expirationTime,
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new NotFoundException('Member not found for update');
      }
    } catch (error) {
      console.error('Error in setPasswordResetOtp:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to set password reset OTP');
    }
  }

  async verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
    const member = await this.memberModel.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (
      !member ||
      !member.resetPasswordOtp ||
      !member.resetPasswordOtpExpires
    ) {
      return false;
    }

    // Check if OTP has expired
    if (new Date() > member.resetPasswordOtpExpires) {
      // Clear expired OTP
      member.resetPasswordOtp = undefined;
      member.resetPasswordOtpExpires = undefined;
      await member.save();
      return false;
    }

    return member.resetPasswordOtp === otp;
  }

  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const member = await this.memberModel.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Verify OTP
    const isOtpValid = await this.verifyPasswordResetOtp(email, otp);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Update password and clear OTP fields
    const bcrypt = await import('bcryptjs');
    member.password = await bcrypt.hash(newPassword, 10);
    member.resetPasswordOtp = undefined;
    member.resetPasswordOtpExpires = undefined;

    await member.save();
  }

  async clearPasswordResetOtp(email: string): Promise<void> {
    const member = await this.memberModel.findOne({
      email: email.toLowerCase(),
      isActive: true,
    });

    if (member) {
      member.resetPasswordOtp = undefined;
      member.resetPasswordOtpExpires = undefined;
      await member.save();
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Member, MemberDocument } from './schemas/member.schema';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberSearchDto } from './dto/member-search.dto';
import { AssignLeadershipDto } from './dto/leadership-assignment.dto';
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

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  async create(createMemberDto: CreateMemberDto): Promise<MemberDocument> {
    // District assignment is now optional
    // Members can be created without district assignment and assigned later

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
      leadershipRoles: createMemberDto.leadershipRoles || {
        isDistrictPastor: false,
        isChamp: false,
        isUnitHead: false,
      },
    });

    return member.save();
  }

  async findAll(
    searchDto: MemberSearchDto,
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
      leadershipRole,
      dateJoinedFrom,
      dateJoinedTo,
      minAge,
      maxAge,
    } = searchDto;

    const skip = (page - 1) * limit;
    const filterQuery: FilterQuery<MemberDocument> = { isActive: true };

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

    // Leadership role filter
    if (leadershipRole) {
      switch (leadershipRole) {
        case 'district_pastor':
          filterQuery['leadershipRoles.isDistrictPastor'] = true;
          break;
        case 'champ':
          filterQuery['leadershipRoles.isChamp'] = true;
          break;
        case 'unit_head':
          filterQuery['leadershipRoles.isUnitHead'] = true;
          break;
      }
    }

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
    const [members, total] = await Promise.all([
      this.memberModel
        .find(filterQuery)
        .populate('district', 'name type')
        .populate('unit', 'name type')
        .populate('spouse', 'firstName lastName')
        .populate('children', 'firstName lastName')
        .populate('parent', 'firstName lastName')
        .populate('additionalGroups', 'name type')
        .populate('leadershipRoles.champForDistrict', 'name')
        .populate('leadershipRoles.leadsUnit', 'name')
        .populate('leadershipRoles.pastorsDistrict', 'name')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(members, total, page, limit);
  }

  async findById(id: string): Promise<MemberDocument | null> {
    return this.memberModel
      .findById(id)
      .populate('district', 'name type description meetingSchedule')
      .populate('unit', 'name type description')
      .populate('spouse', 'firstName lastName email phone')
      .populate('children', 'firstName lastName email phone dateOfBirth')
      .populate('parent', 'firstName lastName email phone')
      .populate('additionalGroups', 'name type description')
      .populate('leadershipRoles.champForDistrict', 'name type')
      .populate('leadershipRoles.leadsUnit', 'name type')
      .populate('leadershipRoles.pastorsDistrict', 'name type')
      .exec();
  }

  async findByUserId(userId: string): Promise<MemberDocument | null> {
    // Note: This assumes you have a way to link User and Member records
    // For now, we'll use email as the link between User and Member
    const user = await this.userModel?.findById(userId);
    if (!user) return null;

    return this.findByEmail(user.email);
  }

  async findByEmail(email: string): Promise<MemberDocument | null> {
    return this.memberModel
      .findOne({ email: email.toLowerCase(), isActive: true })
      .populate('district', 'name type')
      .populate('unit', 'name type')
      .populate('leadershipRoles.champForDistrict', 'name type')
      .populate('leadershipRoles.leadsUnit', 'name type')
      .populate('leadershipRoles.pastorsDistrict', 'name type')
      .exec();
  }

  // Method to check if a user can access a specific member
  async canAccessMember(
    requestingUserEmail: string,
    targetMemberId: string,
  ): Promise<boolean> {
    const requestingMember = await this.findByEmail(requestingUserEmail);
    const targetMember = await this.findById(targetMemberId);

    if (!requestingMember || !targetMember) {
      return false;
    }

    const { leadershipRoles } = requestingMember;

    // District pastor can access members in their district
    if (leadershipRoles.isDistrictPastor && leadershipRoles.pastorsDistrict) {
      return (
        leadershipRoles.pastorsDistrict.toString() ===
        targetMember.district?.toString()
      );
    }

    // Champ can access members in their assigned district
    if (leadershipRoles.isChamp && leadershipRoles.champForDistrict) {
      return (
        leadershipRoles.champForDistrict.toString() ===
        targetMember.district?.toString()
      );
    }

    // Unit head can access members in their unit
    if (
      leadershipRoles.isUnitHead &&
      leadershipRoles.leadsUnit &&
      targetMember.unit
    ) {
      return (
        leadershipRoles.leadsUnit.toString() === targetMember.unit.toString()
      );
    }

    // Members can only access themselves
    return requestingMember.id.toString() === targetMember.id.toString();
  }

  async update(
    id: string,
    updateMemberDto: UpdateMemberDto,
  ): Promise<MemberDocument> {
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

  // Leadership Management
  async assignLeadership(
    assignDto: AssignLeadershipDto,
  ): Promise<MemberDocument> {
    const { memberId, role, districtId, unitId } = assignDto;

    const updateData: any = {};

    switch (role) {
      case 'district_pastor':
        if (!districtId) {
          throw new BadRequestException(
            'District ID is required for district pastor assignment',
          );
        }
        updateData['leadershipRoles.isDistrictPastor'] = true;
        updateData['leadershipRoles.pastorsDistrict'] = districtId;
        updateData['membershipStatus'] = MembershipStatus.DISTRICT_PASTOR;
        break;

      case 'champ':
        if (!districtId) {
          throw new BadRequestException(
            'District ID is required for champ assignment',
          );
        }
        updateData['leadershipRoles.isChamp'] = true;
        updateData['leadershipRoles.champForDistrict'] = districtId;
        updateData['membershipStatus'] = MembershipStatus.CHAMP;
        break;

      case 'unit_head':
        if (!unitId) {
          throw new BadRequestException(
            'Unit ID is required for unit head assignment',
          );
        }
        updateData['leadershipRoles.isUnitHead'] = true;
        updateData['leadershipRoles.leadsUnit'] = unitId;
        updateData['membershipStatus'] = MembershipStatus.UNIT_HEAD;
        break;

      default:
        throw new BadRequestException('Invalid leadership role');
    }

    const member = await this.memberModel
      .findByIdAndUpdate(memberId, { $set: updateData }, { new: true })
      .populate(
        'district unit leadershipRoles.champForDistrict leadershipRoles.leadsUnit leadershipRoles.pastorsDistrict',
      );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async removeLeadership(
    memberId: string,
    role: string,
  ): Promise<MemberDocument> {
    const updateData: any = {};

    switch (role) {
      case 'district_pastor':
        updateData['leadershipRoles.isDistrictPastor'] = false;
        updateData['$unset'] = { 'leadershipRoles.pastorsDistrict': 1 };
        break;
      case 'champ':
        updateData['leadershipRoles.isChamp'] = false;
        updateData['$unset'] = { 'leadershipRoles.champForDistrict': 1 };
        break;
      case 'unit_head':
        updateData['leadershipRoles.isUnitHead'] = false;
        updateData['$unset'] = { 'leadershipRoles.leadsUnit': 1 };
        break;
      default:
        throw new BadRequestException('Invalid leadership role');
    }

    const member = await this.memberModel.findByIdAndUpdate(
      memberId,
      updateData,
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  // Analytics and Reports
  async getMemberStats(): Promise<any> {
    const [
      statusStats,
      genderStats,
      districtStats,
      unitStats,
      leadershipStats,
      ageStats,
      totalMembers,
    ] = await Promise.all([
      // Status distribution
      this.memberModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$membershipStatus', count: { $sum: 1 } } },
      ]),

      // Gender distribution
      this.memberModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]),

      // District distribution
      this.memberModel.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'groups',
            localField: 'district',
            foreignField: '_id',
            as: 'districtInfo',
          },
        },
        { $unwind: '$districtInfo' },
        {
          $group: {
            _id: '$districtInfo.name',
            count: { $sum: 1 },
            districtId: { $first: '$district' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Unit distribution
      this.memberModel.aggregate([
        { $match: { isActive: true, unit: { $exists: true } } },
        {
          $lookup: {
            from: 'groups',
            localField: 'unit',
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

      // Leadership distribution
      this.memberModel.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            roles: {
              $concatArrays: [
                {
                  $cond: [
                    { $eq: ['$leadershipRoles.isDistrictPastor', true] },
                    ['District Pastor'],
                    [],
                  ],
                },
                {
                  $cond: [
                    { $eq: ['$leadershipRoles.isChamp', true] },
                    ['Champ'],
                    [],
                  ],
                },
                {
                  $cond: [
                    { $eq: ['$leadershipRoles.isUnitHead', true] },
                    ['Unit Head'],
                    [],
                  ],
                },
              ],
            },
          },
        },
        { $unwind: { path: '$roles', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$roles', count: { $sum: 1 } } },
      ]),

      // Age distribution
      this.memberModel.aggregate([
        { $match: { isActive: true } },
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
      this.memberModel.countDocuments({ isActive: true }),
    ]);

    const membersWithoutUnits = await this.memberModel.countDocuments({
      isActive: true,
      $or: [{ unit: null }, { unit: { $exists: false } }],
    });

    return {
      total: totalMembers,
      byStatus: statusStats,
      byGender: genderStats,
      byDistrict: districtStats,
      byUnit: unitStats,
      byLeadership: leadershipStats,
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
      .populate(
        'leadershipRoles.champForDistrict leadershipRoles.pastorsDistrict',
      )
      .sort({ firstName: 1, lastName: 1 });
  }

  async getUnitMembers(unitId: string): Promise<MemberDocument[]> {
    return this.memberModel
      .find({ unit: unitId, isActive: true })
      .populate('leadershipRoles.leadsUnit')
      .sort({ firstName: 1, lastName: 1 });
  }

  async getLeaders(): Promise<{
    districtPastors: MemberDocument[];
    champs: MemberDocument[];
    unitHeads: MemberDocument[];
  }> {
    const [districtPastors, champs, unitHeads] = await Promise.all([
      this.memberModel
        .find({
          'leadershipRoles.isDistrictPastor': true,
          isActive: true,
        })
        .populate('leadershipRoles.pastorsDistrict', 'name')
        .sort({ firstName: 1, lastName: 1 }),

      this.memberModel
        .find({
          'leadershipRoles.isChamp': true,
          isActive: true,
        })
        .populate('leadershipRoles.champForDistrict', 'name')
        .sort({ firstName: 1, lastName: 1 }),

      this.memberModel
        .find({
          'leadershipRoles.isUnitHead': true,
          isActive: true,
        })
        .populate('leadershipRoles.leadsUnit', 'name')
        .sort({ firstName: 1, lastName: 1 }),
    ]);

    return { districtPastors, champs, unitHeads };
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

    // Validate district assignment
    if (!processedDto.district) {
      throw new Error('Every member must be assigned to a district');
    }

    const member = new this.memberModel({
      ...processedDto,
      email: processedDto.email.toLowerCase(),
      membershipStatus:
        processedDto.membershipStatus || MembershipStatus.NEW_CONVERT,
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
      leadershipRoles?: {
        isDistrictPastor?: boolean;
        isChamp?: boolean;
        isUnitHead?: boolean;
        champForDistrict?: string;
        leadsUnit?: string;
        pastorsDistrict?: string;
      };
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

    // --- Handle leadership roles ---
    if (updateData.leadershipRoles) {
      const { leadershipRoles } = updateData;

      // Convert string IDs to ObjectIds safely
      const updatedLeadershipRoles = {
        ...member.leadershipRoles,
        ...leadershipRoles,
        champForDistrict: leadershipRoles.champForDistrict
          ? new Types.ObjectId(leadershipRoles.champForDistrict)
          : member.leadershipRoles?.champForDistrict,
        leadsUnit: leadershipRoles.leadsUnit
          ? new Types.ObjectId(leadershipRoles.leadsUnit)
          : member.leadershipRoles?.leadsUnit,
        pastorsDistrict: leadershipRoles.pastorsDistrict
          ? new Types.ObjectId(leadershipRoles.pastorsDistrict)
          : member.leadershipRoles?.pastorsDistrict,
      };

      member.leadershipRoles = updatedLeadershipRoles;
    }

    await member.save();
    return member;
  }
}

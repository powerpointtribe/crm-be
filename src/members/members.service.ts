import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
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
  BulkImportMasterDto,
  MasterImportMemberDto,
  BulkImportMasterResultDto,
} from './dto/bulk-import-master.dto';
import { GroupType } from '../common/enums/group-types.enum';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
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
import { MemberLifecycleService } from '../activity-tracker/member-lifecycle.service';
import { generateDefaultPassword } from '../common/utils/password-generator';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private branchAccessService: BranchAccessService,
    @Inject(forwardRef(() => RolesService))
    private rolesService: RolesService,
    private memberLifecycleService: MemberLifecycleService,
  ) {}

  async create(createMemberDto: CreateMemberDto, initiatedByUserId?: string): Promise<MemberDocument> {
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

    // Validate district exists and is of type 'district'
    if (createMemberDto.district) {
      const district = await this.groupModel.findById(createMemberDto.district);
      if (!district) {
        throw new BadRequestException(
          `District with ID ${createMemberDto.district} not found`,
        );
      }
      if (district.type !== GroupType.DISTRICT) {
        throw new BadRequestException(
          `Group with ID ${createMemberDto.district} is not a district (type: ${district.type})`,
        );
      }
    }

    // Validate unit (if provided) exists and is of type 'unit'
    if (createMemberDto.unit) {
      const unit = await this.groupModel.findById(createMemberDto.unit);
      if (!unit) {
        throw new BadRequestException(
          `Unit with ID ${createMemberDto.unit} not found`,
        );
      }
      if (unit.type !== GroupType.UNIT) {
        throw new BadRequestException(
          `Group with ID ${createMemberDto.unit} is not a unit (type: ${unit.type})`,
        );
      }
    }

    // Determine membership status: if assigned to a unit, upgrade to DC unless already LXL or higher
    let membershipStatus = createMemberDto.membershipStatus;
    if (createMemberDto.unit) {
      const leadershipStatuses = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];
      if (!leadershipStatuses.includes(membershipStatus as MembershipStatus)) {
        membershipStatus = MembershipStatus.DC;
      }
    }

    const member = new this.memberModel({
      ...createMemberDto,
      email: createMemberDto.email.toLowerCase(),
      dateOfBirth,
      membershipStatus,
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

    const savedMember = await member.save();

    // Log lifecycle events asynchronously (don't block the response)
    // Use the provided user ID or fall back to the member's own ID
    const effectiveInitiatorId = initiatedByUserId || savedMember._id.toString();
    this.logMemberCreationEvents(savedMember, createMemberDto, effectiveInitiatorId).catch((err) => {
      console.error('Error logging member creation events:', err);
    });

    return savedMember;
  }

  /**
   * Log all lifecycle events for member creation
   */
  private async logMemberCreationEvents(
    member: MemberDocument,
    createMemberDto: CreateMemberDto,
    initiatedBy: string,
  ): Promise<void> {
    const memberId = member._id.toString();

    try {
      // 1. Log member registration with the dateJoined
      await this.memberLifecycleService.logMemberRegistration(
        memberId,
        initiatedBy,
        'member-creation',
        member.dateJoined,
      );
      console.log(`Activity logged: Member registration for ${memberId}, dateJoined: ${member.dateJoined}`);
    } catch (error) {
      console.error(`Failed to log member registration for ${memberId}:`, error);
    }

    // 2. Log district assignment if provided
    if (createMemberDto.district) {
      try {
        const district = await this.groupModel.findById(createMemberDto.district);
        if (district) {
          await this.memberLifecycleService.logDistrictAssignment(
            memberId,
            createMemberDto.district.toString(),
            district.name,
            initiatedBy,
          );
          console.log(`Activity logged: District assignment for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log district assignment for ${memberId}:`, error);
      }
    }

    // 3. Log unit assignment if provided (first-time = DC enrollment)
    if (createMemberDto.unit) {
      try {
        const unit = await this.groupModel.findById(createMemberDto.unit);
        if (unit) {
          await this.memberLifecycleService.logUnitAssignment(
            memberId,
            createMemberDto.unit.toString(),
            unit.name,
            initiatedBy,
            undefined, // no previous unit
            undefined, // no previous unit name
            true, // is first unit assignment (DC enrollment)
          );
          console.log(`Activity logged: Unit assignment (DC enrollment) for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log unit assignment for ${memberId}:`, error);
      }
    }
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
      hasDistrict,
      birthdayMonth,
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

    // Has district filter (members assigned to any district)
    if (hasDistrict === true) {
      filterQuery.district = { $exists: true, $ne: null };
    } else if (hasDistrict === false) {
      filterQuery.district = { $in: [null, undefined] };
    }

    // Birthday month filter
    if (birthdayMonth !== undefined) {
      filterQuery.$expr = {
        $eq: [{ $month: '$dateOfBirth' }, birthdayMonth],
      };
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
    // Optimized query with lean() and reduced populates for list view
    // Only populate essential fields needed for list display
    const [members, total] = await Promise.all([
      this.memberModel
        .find(filterQuery)
        .select('_id firstName lastName email phone membershipStatus dateJoined dateOfBirth branch district unit isActive')
        .populate({
          path: 'branch',
          select: '_id name',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'district',
          select: '_id name type',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'unit',
          select: '_id name type',
          options: { strictPopulate: false }
        })
        .lean() // Return plain JS objects for better performance
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments(filterQuery),
    ]);

    // Clean members with invalid district/unit references
    // Since we're using lean(), members are already plain objects
    const cleanedMembers = members.map(member => {
      // If district is not a valid populated object, set it to undefined
      if (member.district && typeof member.district === 'string') {
        delete member.district;
      }

      // If unit is not a valid populated object, set it to undefined
      if (member.unit && typeof member.unit === 'string') {
        delete member.unit;
      }

      return member;
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

  async updatePreferences(
    memberId: string,
    preferences: Partial<{
      theme: 'light' | 'dark' | 'system';
      language: string;
      notifications: {
        email?: boolean;
        sms?: boolean;
        push?: boolean;
        followUpReminders?: boolean;
        weeklyReports?: boolean;
      };
      display: {
        compactMode?: boolean;
        showWelcomeMessage?: boolean;
      };
    }>,
  ): Promise<MemberDocument | null> {
    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Merge preferences with existing
    const updatedPreferences = {
      theme: preferences.theme || member.preferences?.theme || 'system',
      language: preferences.language || member.preferences?.language || 'en',
      notifications: {
        email: preferences.notifications?.email ?? member.preferences?.notifications?.email ?? true,
        sms: preferences.notifications?.sms ?? member.preferences?.notifications?.sms ?? false,
        push: preferences.notifications?.push ?? member.preferences?.notifications?.push ?? true,
        followUpReminders: preferences.notifications?.followUpReminders ?? member.preferences?.notifications?.followUpReminders ?? true,
        weeklyReports: preferences.notifications?.weeklyReports ?? member.preferences?.notifications?.weeklyReports ?? false,
      },
      display: {
        compactMode: preferences.display?.compactMode ?? member.preferences?.display?.compactMode ?? false,
        showWelcomeMessage: preferences.display?.showWelcomeMessage ?? member.preferences?.display?.showWelcomeMessage ?? true,
      },
    };

    return this.memberModel
      .findByIdAndUpdate(
        memberId,
        { $set: { preferences: updatedPreferences } },
        { new: true },
      )
      .exec();
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
    initiatedByUserId?: string,
  ): Promise<MemberDocument> {
    // Get the existing member to compare changes
    const existingMember = await this.memberModel
      .findById(id)
      .populate('district', 'name type')
      .populate('unit', 'name type')
      .exec();

    if (!existingMember) {
      throw new NotFoundException('Member not found');
    }

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

    // Track if this is a first-time unit assignment
    const isFirstUnitAssignment = !existingMember.unit && !!updateMemberDto.unit;

    // If unit is being assigned, check if membership status needs to be upgraded to DC
    if (updateMemberDto.unit) {
      // Leadership statuses that should NOT be downgraded to DC
      const leadershipStatuses = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];

      // Auto-upgrade to DC if not already a leader (LXL or higher)
      if (!leadershipStatuses.includes(existingMember.membershipStatus as MembershipStatus)) {
        (updateMemberDto as any).membershipStatus = MembershipStatus.DC;
      }
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

    // Log lifecycle events asynchronously (don't block the response)
    // Use the provided user ID or fall back to the member's own ID
    const effectiveInitiatorId = initiatedByUserId || member._id.toString();
    this.logMemberUpdateEvents(existingMember, member, updateMemberDto, isFirstUnitAssignment, effectiveInitiatorId).catch((err) => {
      console.error('Error logging member update events:', err);
    });

    return member;
  }

  /**
   * Log lifecycle events for member updates
   */
  private async logMemberUpdateEvents(
    oldMember: MemberDocument,
    newMember: MemberDocument,
    updateMemberDto: UpdateMemberDto,
    isFirstUnitAssignment: boolean,
    initiatedBy: string,
  ): Promise<void> {
    const memberId = newMember._id.toString();

    // 1. Log isActive change (deactivation/reactivation)
    if (updateMemberDto.isActive !== undefined && oldMember.isActive !== updateMemberDto.isActive) {
      try {
        if (updateMemberDto.isActive === false) {
          await this.memberLifecycleService.logMemberDeactivation(
            memberId,
            'Member deactivated',
            initiatedBy,
          );
          console.log(`Activity logged: Member deactivation for ${memberId}`);
        } else {
          await this.memberLifecycleService.logMemberReactivation(
            memberId,
            initiatedBy,
          );
          console.log(`Activity logged: Member reactivation for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log isActive change for ${memberId}:`, error);
      }
    }

    // 2. Log branch change (branch transfer)
    const oldBranchId = (oldMember.branch as any)?._id?.toString() || oldMember.branch?.toString();
    const newBranchId = updateMemberDto.branch?.toString();

    if (newBranchId && newBranchId !== oldBranchId) {
      try {
        const newBranch = await this.branchModel.findById(newBranchId);
        const oldBranch = oldBranchId ? await this.branchModel.findById(oldBranchId) : null;

        if (newBranch && oldBranch) {
          await this.memberLifecycleService.logBranchTransfer(
            memberId,
            oldBranchId,
            oldBranch.name,
            newBranchId,
            newBranch.name,
            initiatedBy,
          );
          console.log(`Activity logged: Branch transfer for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log branch transfer for ${memberId}:`, error);
      }
    }

    // 3. Log district change
    const oldDistrictId = (oldMember.district as any)?._id?.toString() || oldMember.district?.toString();
    const newDistrictId = updateMemberDto.district?.toString();

    if (newDistrictId && newDistrictId !== oldDistrictId) {
      try {
        const newDistrict = await this.groupModel.findById(newDistrictId);
        const oldDistrict = oldDistrictId ? await this.groupModel.findById(oldDistrictId) : null;

        if (newDistrict) {
          await this.memberLifecycleService.logDistrictAssignment(
            memberId,
            newDistrictId,
            newDistrict.name,
            initiatedBy,
            oldDistrictId,
            oldDistrict?.name,
          );
          console.log(`Activity logged: District change for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log district change for ${memberId}:`, error);
      }
    }

    // 4. Log unit change
    const oldUnitId = (oldMember.unit as any)?._id?.toString() || oldMember.unit?.toString();
    const newUnitId = updateMemberDto.unit?.toString();

    if (newUnitId && newUnitId !== oldUnitId) {
      try {
        const newUnit = await this.groupModel.findById(newUnitId);
        const oldUnit = oldUnitId ? await this.groupModel.findById(oldUnitId) : null;

        if (newUnit) {
          await this.memberLifecycleService.logUnitAssignment(
            memberId,
            newUnitId,
            newUnit.name,
            initiatedBy,
            oldUnitId,
            oldUnit?.name,
            isFirstUnitAssignment, // Mark as DC enrollment if first unit
          );
          console.log(`Activity logged: Unit change for ${memberId}`);
        }
      } catch (error) {
        console.error(`Failed to log unit change for ${memberId}:`, error);
      }
    }

    // 5. Log membership status change
    const oldStatus = oldMember.membershipStatus;
    const newStatus = updateMemberDto.membershipStatus || (newMember as any).membershipStatus;

    if (newStatus && oldStatus !== newStatus) {
      try {
        await this.memberLifecycleService.logMembershipStatusChange(
          memberId,
          oldStatus,
          newStatus,
          initiatedBy,
          'Membership status updated',
        );
        console.log(`Activity logged: Membership status change for ${memberId}`);
      } catch (error) {
        console.error(`Failed to log membership status change for ${memberId}:`, error);
      }
    }
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
    // Validate that districtId is a valid district
    const district = await this.groupModel.findById(districtId);
    if (!district) {
      throw new NotFoundException(`District with ID ${districtId} not found`);
    }
    if (district.type !== GroupType.DISTRICT) {
      throw new BadRequestException(
        `Group with ID ${districtId} is not a district (type: ${district.type})`,
      );
    }

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
    // Validate that unitId is a valid unit
    const unit = await this.groupModel.findById(unitId);
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }
    if (unit.type !== GroupType.UNIT) {
      throw new BadRequestException(
        `Group with ID ${unitId} is not a unit (type: ${unit.type})`,
      );
    }

    const member = await this.memberModel.findById(memberId);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Leadership statuses that should NOT be downgraded to DC
    const leadershipStatuses = [
      MembershipStatus.LXL,
      MembershipStatus.DIRECTOR,
      MembershipStatus.PASTOR,
      MembershipStatus.CAMPUS_PASTOR,
      MembershipStatus.SENIOR_PASTOR,
    ];

    // Update unit
    member.unit = new Types.ObjectId(unitId);

    // Auto-upgrade to DC if not already a leader (LXL or higher)
    if (!leadershipStatuses.includes(member.membershipStatus as MembershipStatus)) {
      member.membershipStatus = MembershipStatus.DC;
    }

    await member.save();

    // Return with populated unit
    return this.memberModel
      .findById(memberId)
      .populate('unit', 'name type')
      .exec() as Promise<MemberDocument>;
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
      leadershipStats,
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

      // Leadership distribution (DC, LXL, DIRECTOR, PASTOR, CAMPUS_PASTOR, SENIOR_PASTOR)
      this.memberModel.aggregate([
        {
          $match: {
            ...baseFilter,
            membershipStatus: {
              $in: ['DC', 'LXL', 'DIRECTOR', 'PASTOR', 'CAMPUS_PASTOR', 'SENIOR_PASTOR'],
            },
          },
        },
        { $group: { _id: '$membershipStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
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
      byLeadership: leadershipStats,
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

  /**
   * Get members whose birthday is today
   */
  async getBirthdaysToday(branchId?: string): Promise<MemberDocument[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const matchStage: any = {
      birthdayThisYear: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      isActive: true,
    };

    if (branchId) {
      matchStage.branch = new Types.ObjectId(branchId);
    }

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
        $match: matchStage,
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
        $lookup: {
          from: 'branches',
          localField: 'branch',
          foreignField: '_id',
          as: 'branch',
        },
      },
      {
        $unwind: { path: '$district', preserveNullAndEmptyArrays: true },
      },
      {
        $unwind: { path: '$branch', preserveNullAndEmptyArrays: true },
      },
    ]);
  }

  /**
   * Get members whose birthday is in N days
   */
  async getBirthdaysInDays(days: number, branchId?: string): Promise<MemberDocument[]> {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    const startOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const matchStage: any = {
      birthdayThisYear: {
        $gte: startOfTargetDay,
        $lte: endOfTargetDay,
      },
      isActive: true,
    };

    if (branchId) {
      matchStage.branch = new Types.ObjectId(branchId);
    }

    return this.memberModel.aggregate([
      {
        $addFields: {
          birthdayThisYear: {
            $dateFromParts: {
              year: targetDate.getFullYear(),
              month: { $month: '$dateOfBirth' },
              day: { $dayOfMonth: '$dateOfBirth' },
            },
          },
        },
      },
      {
        $match: matchStage,
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
        $lookup: {
          from: 'branches',
          localField: 'branch',
          foreignField: '_id',
          as: 'branch',
        },
      },
      {
        $unwind: { path: '$district', preserveNullAndEmptyArrays: true },
      },
      {
        $unwind: { path: '$branch', preserveNullAndEmptyArrays: true },
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

    const dtoClass =
      operationType === BulkOperationType.CREATE
        ? CreateMemberDto
        : UpdateMemberDto;

    const result = await BulkOperationUtil.processBulkOperation(
      csvContent,
      dtoClass as new () => CreateMemberDto,
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

    // Determine membership status: if assigned to a unit, upgrade to DC unless already LXL or higher
    let membershipStatus = processedDto.membershipStatus || MembershipStatus.MEMBER;
    if (processedDto.unit) {
      const leadershipStatuses = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];
      if (!leadershipStatuses.includes(membershipStatus as MembershipStatus)) {
        membershipStatus = MembershipStatus.DC;
      }
    }

    const member = new this.memberModel({
      ...processedDto,
      email: processedDto.email.toLowerCase(),
      membershipStatus,
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

      // Leadership statuses that should NOT be downgraded to DC
      const leadershipStatuses = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];

      // Auto-upgrade to DC if not already a leader (LXL or higher)
      if (!leadershipStatuses.includes(member.membershipStatus as MembershipStatus)) {
        member.membershipStatus = MembershipStatus.DC;
      }
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

  /**
   * Reset password using a token (from email link)
   */
  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    // Find member by reset token
    const member = await this.memberModel.findOne({
      resetPasswordOtp: token,
      isActive: true,
    });

    if (!member) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    // Check if token has expired
    if (!member.resetPasswordOtpExpires || new Date() > member.resetPasswordOtpExpires) {
      // Clear expired token
      member.resetPasswordOtp = undefined;
      member.resetPasswordOtpExpires = undefined;
      await member.save();
      throw new BadRequestException('Reset link has expired. Please request a new one.');
    }

    // Update password and clear token fields
    const bcrypt = await import('bcryptjs');
    member.password = await bcrypt.hash(newPassword, 10);
    member.resetPasswordOtp = undefined;
    member.resetPasswordOtpExpires = undefined;

    await member.save();
  }

  /**
   * Verify if a reset token is valid (for frontend validation)
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const member = await this.memberModel.findOne({
      resetPasswordOtp: token,
      isActive: true,
    });

    if (!member || !member.resetPasswordOtpExpires) {
      return { valid: false };
    }

    if (new Date() > member.resetPasswordOtpExpires) {
      return { valid: false };
    }

    return { valid: true, email: member.email };
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

  // ============================================
  // MASTER BULK IMPORT
  // Creates members, districts, units, and assigns leadership
  // ============================================

  /**
   * Master bulk import - creates members with their districts, units, and leadership assignments
   * This is the comprehensive import that can create the entire church structure from a spreadsheet
   */
  async bulkImportMaster(
    dto: BulkImportMasterDto,
  ): Promise<BulkImportMasterResultDto> {
    const result: BulkImportMasterResultDto = {
      totalProcessed: 0,
      membersCreated: 0,
      membersSkipped: 0,
      branchesCreated: 0,
      districtsCreated: 0,
      unitsCreated: 0,
      districtPastorsAssigned: 0,
      unitHeadsAssigned: 0,
      errors: [],
      createdMemberIds: [],
    };

    // Generate secure default password if not provided
    // IMPORTANT: If using bulk import, consider providing a strong password
    // and sending it to users via email
    let defaultPassword = dto.defaultPassword;
    if (!defaultPassword) {
      defaultPassword = generateDefaultPassword();
      this.logger.warn(
        `No default password provided for bulk import. Generated secure password: ${defaultPassword}. ` +
        `IMPORTANT: Share this password with imported users securely and require them to change it on first login.`,
      );
    }

    const { members, skipExisting = true } = dto;

    // Get default member role
    const memberRole = await this.rolesService.findBySlug('member');
    const districtPastorRole = await this.rolesService.findBySlug('district-pastor');
    const unitHeadRole = await this.rolesService.findBySlug('unit-head');

    if (!memberRole) {
      throw new BadRequestException('Default member role not found. Please run seed:admin first.');
    }

    // Cache for branches, districts and units to avoid duplicate lookups/creations
    const branchCache = new Map<string, Types.ObjectId>();
    const districtCache = new Map<string, Types.ObjectId>();
    const unitCache = new Map<string, Types.ObjectId>();

    // Track leadership assignments to process after all members are created
    const leadershipAssignments: Array<{
      memberId: Types.ObjectId;
      memberEmail: string;
      districtName?: string;
      unitName?: string;
      isDistrictPastor: boolean;
      isUnitHead: boolean;
      isAssistantUnitHead: boolean;
    }> = [];

    // Hash the default password once
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Process each member
    for (let i = 0; i < members.length; i++) {
      const row = members[i];
      result.totalProcessed++;

      try {
        // Check if member already exists
        const existingMember = await this.memberModel.findOne({
          email: row.email.toLowerCase(),
        });

        if (existingMember) {
          if (skipExisting) {
            result.membersSkipped++;
            continue;
          } else {
            result.errors.push({
              row: i + 1,
              email: row.email,
              error: 'Member with this email already exists',
            });
            continue;
          }
        }

        // Get or create branch first (required for each member)
        const branchId = await this.getOrCreateBranch(
          row.branchName,
          branchCache,
          result,
        );

        // Get or create district
        let districtId: Types.ObjectId | undefined;
        if (row.districtName) {
          districtId = await this.getOrCreateGroup(
            row.districtName,
            GroupType.DISTRICT,
            branchId.toString(),
            districtCache,
            result,
          );
        }

        // Get or create unit
        let unitId: Types.ObjectId | undefined;
        if (row.unitName) {
          unitId = await this.getOrCreateGroup(
            row.unitName,
            GroupType.UNIT,
            branchId.toString(),
            unitCache,
            result,
          );
        }

        // Determine initial role
        let roleId = (memberRole as any)._id;
        let membershipStatus = row.membershipStatus || MembershipStatus.MEMBER;

        // If they're a leader, upgrade their role and status
        if (row.isDistrictPastor && districtPastorRole) {
          roleId = (districtPastorRole as any)._id;
          if (membershipStatus === MembershipStatus.MEMBER || membershipStatus === MembershipStatus.DC) {
            membershipStatus = MembershipStatus.LXL;
          }
        } else if ((row.isUnitHead || row.isAssistantUnitHead) && unitHeadRole) {
          roleId = (unitHeadRole as any)._id;
          if (membershipStatus === MembershipStatus.MEMBER) {
            membershipStatus = MembershipStatus.DC;
          }
        } else if (unitId) {
          // Regular member with unit assignment gets DC status
          if (membershipStatus === MembershipStatus.MEMBER) {
            membershipStatus = MembershipStatus.DC;
          }
        }

        // Validate and parse date of birth
        let dateOfBirth: Date | undefined;
        if (row.dateOfBirth) {
          dateOfBirth = new Date(row.dateOfBirth);
          if (isNaN(dateOfBirth.getTime())) {
            dateOfBirth = new Date('1990-01-01'); // Default if invalid
          }
        } else {
          dateOfBirth = new Date('1990-01-01'); // Default
        }

        // Create the member
        const newMember = new this.memberModel({
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.toLowerCase().trim(),
          phone: row.phone.trim(),
          password: hashedPassword,
          dateOfBirth,
          gender: row.gender,
          maritalStatus: row.maritalStatus || 'single',
          membershipStatus,
          role: roleId,
          branch: branchId,
          district: districtId,
          unit: unitId,
          isActive: true,
          dateJoined: row.dateJoined ? new Date(row.dateJoined) : new Date(),
          occupation: row.occupation,
          notes: row.notes,
          address: {
            street: row.street || '',
            city: row.city || '',
            state: row.state || 'Lagos',
            country: 'Nigeria',
          },
        });

        await newMember.save();
        result.membersCreated++;
        result.createdMemberIds.push(newMember._id.toString());

        // Add member to district
        if (districtId) {
          await this.groupModel.findByIdAndUpdate(districtId, {
            $addToSet: { members: newMember._id },
            $inc: { currentMemberCount: 1 },
          });
        }

        // Add member to unit
        if (unitId) {
          await this.groupModel.findByIdAndUpdate(unitId, {
            $addToSet: { members: newMember._id },
            $inc: { currentMemberCount: 1 },
          });
        }

        // Track leadership assignments for later
        if (row.isDistrictPastor || row.isUnitHead || row.isAssistantUnitHead) {
          leadershipAssignments.push({
            memberId: newMember._id,
            memberEmail: row.email,
            districtName: row.districtName,
            unitName: row.unitName,
            isDistrictPastor: row.isDistrictPastor || false,
            isUnitHead: row.isUnitHead || false,
            isAssistantUnitHead: row.isAssistantUnitHead || false,
          });
        }
      } catch (error) {
        result.errors.push({
          row: i + 1,
          email: row.email,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Process leadership assignments
    for (const assignment of leadershipAssignments) {
      try {
        // Assign district pastor
        if (assignment.isDistrictPastor && assignment.districtName) {
          const districtId = districtCache.get(assignment.districtName);
          if (districtId) {
            await this.groupModel.findByIdAndUpdate(districtId, {
              $set: { districtPastor: assignment.memberId },
            });

            // Update member's assignedDistricts
            await this.memberModel.findByIdAndUpdate(assignment.memberId, {
              $addToSet: { assignedDistricts: districtId },
            });

            result.districtPastorsAssigned++;
          }
        }

        // Assign unit head
        if (assignment.isUnitHead && assignment.unitName) {
          const unitId = unitCache.get(assignment.unitName);
          if (unitId) {
            await this.groupModel.findByIdAndUpdate(unitId, {
              $set: { unitHead: assignment.memberId },
            });
            result.unitHeadsAssigned++;
          }
        }

        // Assign assistant unit head
        if (assignment.isAssistantUnitHead && assignment.unitName) {
          const unitId = unitCache.get(assignment.unitName);
          if (unitId) {
            await this.groupModel.findByIdAndUpdate(unitId, {
              $set: { assistantUnitHead: assignment.memberId },
            });
          }
        }
      } catch (error) {
        result.errors.push({
          row: 0,
          email: assignment.memberEmail,
          error: `Leadership assignment failed: ${error.message}`,
        });
      }
    }

    return result;
  }

  /**
   * Helper: Get or create a branch by name
   */
  private async getOrCreateBranch(
    name: string,
    cache: Map<string, Types.ObjectId>,
    result: BulkImportMasterResultDto,
  ): Promise<Types.ObjectId> {
    // Check cache first
    const cacheKey = name.toLowerCase().trim();
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    // Try to find existing branch
    let branch = await this.branchModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      isActive: true,
    });

    if (!branch) {
      // Create new branch with slug
      const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      branch = new this.branchModel({
        name: name.trim(),
        slug,
        isActive: true,
        isMainBranch: false,
        timezone: 'Africa/Lagos',
        address: {
          street: '',
          city: '',
          state: '',
          country: 'Nigeria',
        },
      });
      await branch.save();
      result.branchesCreated++;
    }

    // Cache for future lookups
    cache.set(cacheKey, branch._id as Types.ObjectId);

    return branch._id as Types.ObjectId;
  }

  /**
   * Helper: Get or create a group (district/unit) by name
   */
  private async getOrCreateGroup(
    name: string,
    type: GroupType,
    branchId: string,
    cache: Map<string, Types.ObjectId>,
    result: BulkImportMasterResultDto,
  ): Promise<Types.ObjectId> {
    // Check cache first
    const cacheKey = name.toLowerCase().trim();
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    // Try to find existing group
    let group = await this.groupModel.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      type,
      branch: new Types.ObjectId(branchId),
      isActive: true,
    });

    if (!group) {
      // Create new group
      group = new this.groupModel({
        name: name.trim(),
        type,
        branch: new Types.ObjectId(branchId),
        isActive: true,
        currentMemberCount: 0,
        members: [],
      });
      await group.save();

      // Update result counters
      if (type === GroupType.DISTRICT) {
        result.districtsCreated++;
      } else if (type === GroupType.UNIT) {
        result.unitsCreated++;
      }
    }

    // Cache for future lookups
    cache.set(cacheKey, group._id as Types.ObjectId);

    return group._id as Types.ObjectId;
  }

  /**
   * Generate a sample CSV template for master import
   */
  generateMasterImportTemplate(): string {
    const headers = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'dateOfBirth',
      'gender',
      'maritalStatus',
      'branchName',
      'districtName',
      'isDistrictPastor',
      'unitName',
      'isUnitHead',
      'isAssistantUnitHead',
      'membershipStatus',
      'street',
      'city',
      'state',
      'occupation',
      'dateJoined',
      'notes',
    ];

    const sampleRows = [
      // District Pastor
      'Pastor,Emmanuel,pastor.emmanuel@church.com,+2348010000001,1980-03-15,male,married,Main Campus,District 1 - Ikeja,true,,,false,PASTOR,,Lagos,Lagos,Minister,2020-01-01,Senior Pastor of District 1',
      // Unit Head
      'David,Ojo,david.ojo@church.com,+2348020000001,1990-05-10,male,single,Main Campus,District 1 - Ikeja,false,Media Unit,true,false,DC,,Lagos,Lagos,Software Engineer,2021-06-15,Leads media team',
      // Assistant Unit Head
      'Sarah,Adeyemi,sarah.adeyemi@church.com,+2348020000002,1992-11-25,female,married,Main Campus,District 2 - Lekki,false,Choir Unit,false,true,DC,,Lagos,Lagos,Music Teacher,2021-03-20,Assistant choir leader',
      // Regular Member
      'John,Okonkwo,john.okonkwo@church.com,+2348030000001,1995-01-15,male,single,Main Campus,District 1 - Ikeja,false,Media Unit,false,false,MEMBER,15 Allen Avenue,Ikeja,Lagos,Accountant,2022-01-01,',
    ];

    return [headers.join(','), ...sampleRows].join('\n');
  }
}

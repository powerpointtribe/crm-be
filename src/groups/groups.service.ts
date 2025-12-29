import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSearchDto } from './dto/group-search.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import { GroupType } from '../common/enums/group-types.enum';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private branchAccessService: BranchAccessService,
  ) {}

  async create(createGroupDto: CreateGroupDto): Promise<GroupDocument> {
    // Validate group type specific requirements
    await this.validateGroupRequirements(createGroupDto);

    // Check if group name already exists
    const existingGroup = await this.groupModel.findOne({
      name: createGroupDto.name,
      type: createGroupDto.type,
      isActive: true,
    });

    if (existingGroup) {
      throw new ConflictException(
        `${createGroupDto.type} with name '${createGroupDto.name}' already exists`,
      );
    }

    const group = new this.groupModel({
      ...createGroupDto,
      currentMemberCount: createGroupDto.members?.length || 0,
      goals: createGroupDto.goals || [],
    });

    return group.save();
  }

  private async validateGroupRequirements(
    groupDto: CreateGroupDto | UpdateGroupDto,
  ): Promise<void> {
    const { type, districtPastor, unitHead } = groupDto;

    // District pastor and unit head are now optional
    // Validation only occurs if they are provided
    if (type === GroupType.DISTRICT && districtPastor) {
      // TODO: Validate that districtPastor exists and is not already pastoring another district
    }

    if (type === GroupType.UNIT && unitHead) {
      // TODO: Validate that unitHead exists and is not already leading another unit
    }
  }

  async findAll(
    searchDto: GroupSearchDto,
    branchFilterContext?: BranchFilterContext,
  ): Promise<PaginatedResult<GroupDocument>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      type,
      districtPastorId,
      unitHeadId,
      isActive = true,
      needsLeaders,
      nearCapacity,
      branchId,
    } = searchDto;

    const skip = (page - 1) * limit;
    let filterQuery: FilterQuery<GroupDocument> = { isActive };

    // Apply branch filtering based on user permissions
    if (branchFilterContext) {
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
        'name',
        'description',
        'vision',
        'mission',
      ]);
      Object.assign(filterQuery, searchQuery);
    }

    // Type filter
    if (type) {
      filterQuery.type = type;
    }

    // Leadership filters
    if (districtPastorId) {
      filterQuery.districtPastor = districtPastorId;
    }

    if (unitHeadId) {
      filterQuery.unitHead = unitHeadId;
    }

    // Special filters
    if (needsLeaders) {
      filterQuery.$or = [
        { type: GroupType.DISTRICT, districtPastor: { $exists: false } },
        { type: GroupType.UNIT, unitHead: { $exists: false } },
      ];
    }

    if (nearCapacity) {
      // Find groups at 80% or more of capacity
      filterQuery.$expr = {
        $gte: [{ $divide: ['$currentMemberCount', '$maxCapacity'] }, 0.8],
      };
      filterQuery.maxCapacity = { $gt: 0 }; // Only groups with defined capacity
    }

    // Build sort query
    const sortQuery = QueryBuilder.buildSortQuery(sortBy, sortOrder);

    // Execute queries with proper population
    const [groups, total] = await Promise.all([
      this.groupModel
        .find(filterQuery)
        .populate('districtPastor', 'firstName lastName email phone')
        .populate('unitHead', 'firstName lastName email phone')
        .populate('champs', 'firstName lastName email phone')
        .populate('members', 'firstName lastName email phone membershipStatus')
        .populate('hostingInfo.hostMember', 'firstName lastName phone')
        .populate('hostingInfo.rotatingHosts', 'firstName lastName phone')
        .populate('hostingInfo.currentHost', 'firstName lastName phone')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.groupModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(groups, total, page, limit);
  }

  async findById(id: string): Promise<GroupDocument | null> {
    return this.groupModel
      .findById(id)
      .populate(
        'districtPastor',
        'firstName lastName email phone membershipStatus',
      )
      .populate('unitHead', 'firstName lastName email phone membershipStatus')
      .populate(
        'assistantUnitHead',
        'firstName lastName email phone membershipStatus',
      )
      .populate(
        'ministryDirector',
        'firstName lastName email phone membershipStatus',
      )
      .populate('champs', 'firstName lastName email phone membershipStatus')
      .populate(
        'members',
        'firstName lastName email phone membershipStatus dateJoined',
      )
      .populate('linkedUnits', 'name type currentMemberCount')
      .populate('defaultRole', 'name displayName slug')
      .populate('hostingInfo.hostMember', 'firstName lastName phone address')
      .populate('hostingInfo.rotatingHosts', 'firstName lastName phone address')
      .populate('hostingInfo.currentHost', 'firstName lastName phone address')
      .exec();
  }

  async findByType(type: GroupType): Promise<GroupDocument[]> {
    return this.groupModel
      .find({ type, isActive: true })
      .populate('districtPastor', 'firstName lastName')
      .populate('unitHead', 'firstName lastName')
      .sort({ name: 1 })
      .exec();
  }

  async findByNameAndType(
    name: string,
    type: GroupType,
  ): Promise<GroupDocument | null> {
    return this.groupModel
      .findOne({ name, type, isActive: true })
      .populate('districtPastor', 'firstName lastName email phone')
      .populate('unitHead', 'firstName lastName email phone')
      .exec();
  }

  async update(
    id: string,
    updateGroupDto: UpdateGroupDto,
  ): Promise<GroupDocument> {
    // Validate requirements if type or leadership is being updated
    if (
      updateGroupDto.type ||
      updateGroupDto.districtPastor ||
      updateGroupDto.unitHead
    ) {
      const existingGroup = await this.findById(id);
      if (existingGroup) {
        const mergedData = { ...existingGroup.toObject(), ...updateGroupDto };
        await this.validateGroupRequirements(mergedData);
      }
    }

    // Update member count if members array is provided
    if (updateGroupDto.members) {
      updateGroupDto['currentMemberCount'] = updateGroupDto.members.length;
    }

    const group = await this.groupModel
      .findByIdAndUpdate(
        id,
        { $set: updateGroupDto },
        { new: true, runValidators: true },
      )
      .populate('districtPastor unitHead champs members')
      .exec();

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  // Member Management
  async addMember(groupId: string, memberId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if member is already in the group
    if (group.members.includes(memberId as any)) {
      throw new ConflictException('Member is already in this group');
    }

    // Check capacity
    if (group.maxCapacity && group.currentMemberCount >= group.maxCapacity) {
      throw new BadRequestException('Group is at maximum capacity');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        {
          $addToSet: { members: memberId },
          $inc: { currentMemberCount: 1 },
        },
        { new: true },
      )
      .populate('members', 'firstName lastName email phone');

    return updatedGroup!;
  }

  async removeMember(
    groupId: string,
    memberId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        {
          $pull: { members: memberId },
          $inc: { currentMemberCount: -1 },
        },
        { new: true },
      )
      .populate('members', 'firstName lastName email phone');

    return updatedGroup!;
  }

  // Leadership Management
  async assignDistrictPastor(
    groupId: string,
    pastorId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.DISTRICT) {
      throw new BadRequestException('Only districts can have district pastors');
    }

    // TODO: Check if pastor is already leading another district
    // TODO: Update member's leadership role

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $set: { districtPastor: pastorId } },
        { new: true },
      )
      .populate('districtPastor', 'firstName lastName email phone');

    return updatedGroup!;
  }

  async assignUnitHead(
    groupId: string,
    headId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.UNIT) {
      throw new BadRequestException('Only units can have unit heads');
    }

    // TODO: Check if head is already leading another unit
    // TODO: Update member's leadership role

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $set: { unitHead: headId } }, { new: true })
      .populate('unitHead', 'firstName lastName email phone');

    return updatedGroup!;
  }

  async addChamp(groupId: string, champId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.DISTRICT) {
      throw new BadRequestException('Only districts can have champs');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $addToSet: { champs: champId } },
        { new: true },
      )
      .populate('champs', 'firstName lastName email phone');

    return updatedGroup!;
  }

  async removeChamp(groupId: string, champId: string): Promise<GroupDocument> {
    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $pull: { champs: champId } }, { new: true })
      .populate('champs', 'firstName lastName email phone');

    if (!updatedGroup) {
      throw new NotFoundException('Group not found');
    }

    return updatedGroup;
  }

  // Hosting Management (for Districts)
  async updateHosting(
    groupId: string,
    hostingInfo: any,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.DISTRICT) {
      throw new BadRequestException(
        'Only districts can have hosting information',
      );
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $set: { hostingInfo } }, { new: true })
      .populate(
        'hostingInfo.hostMember hostingInfo.rotatingHosts hostingInfo.currentHost',
      );

    return updatedGroup!;
  }

  async rotateHost(groupId: string): Promise<GroupDocument> {
    const group = await this.findById(groupId);
    if (!group || !group.hostingInfo?.rotatingHosts?.length) {
      throw new BadRequestException(
        'Group does not have rotating hosts set up',
      );
    }

    const { rotatingHosts, currentHost } = group.hostingInfo;
    const currentIndex = currentHost
      ? rotatingHosts.findIndex(
          (host) => host.toString() === currentHost.toString(),
        )
      : -1;

    const nextIndex = (currentIndex + 1) % rotatingHosts.length;
    const nextHost = rotatingHosts[nextIndex];

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $set: { 'hostingInfo.currentHost': nextHost } },
        { new: true },
      )
      .populate('hostingInfo.currentHost', 'firstName lastName phone address');

    return updatedGroup!;
  }

  // Analytics and Reports
  async getGroupStats(): Promise<any> {
    const [typeStats, leadershipStats, capacityStats, totalGroups] =
      await Promise.all([
        // Groups by type
        this.groupModel.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),

        // Leadership coverage
        this.groupModel.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$type',
              total: { $sum: 1 },
              withLeaders: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: ['$type', 'district'] },
                            { $ne: ['$districtPastor', null] },
                          ],
                        },
                        {
                          $and: [
                            { $eq: ['$type', 'unit'] },
                            { $ne: ['$unitHead', null] },
                          ],
                        },
                        { $not: { $in: ['$type', ['district', 'unit']] } },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Capacity utilization
        this.groupModel.aggregate([
          { $match: { isActive: true, maxCapacity: { $gt: 0 } } },
          {
            $project: {
              name: 1,
              type: 1,
              currentMemberCount: 1,
              maxCapacity: 1,
              utilizationRate: {
                $multiply: [
                  { $divide: ['$currentMemberCount', '$maxCapacity'] },
                  100,
                ],
              },
            },
          },
          {
            $bucket: {
              groupBy: '$utilizationRate',
              boundaries: [0, 50, 75, 90, 100, 150],
              default: 'over-capacity',
              output: {
                count: { $sum: 1 },
                avgUtilization: { $avg: '$utilizationRate' },
              },
            },
          },
        ]),

        // Total active groups
        this.groupModel.countDocuments({ isActive: true }),
      ]);

    return {
      total: totalGroups,
      byType: typeStats,
      leadershipCoverage: leadershipStats,
      capacityUtilization: capacityStats,
    };
  }

  async getDistrictsNeedingPastors(
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<GroupDocument>> {
    const skip = (page - 1) * limit;

    const filterQuery = {
      type: GroupType.DISTRICT,
      isActive: true,
      $or: [{ districtPastor: null }, { districtPastor: { $exists: false } }],
    };

    const [districts, total] = await Promise.all([
      this.groupModel
        .find(filterQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.groupModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(districts, total, page, limit);
  }

  async getUnitsNeedingHeads(
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<GroupDocument>> {
    const skip = (page - 1) * limit;

    const filterQuery = {
      type: GroupType.UNIT,
      isActive: true,
      $or: [{ unitHead: null }, { unitHead: { $exists: false } }],
    };

    const [units, total] = await Promise.all([
      this.groupModel
        .find(filterQuery)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.groupModel.countDocuments(filterQuery),
    ]);

    return createPaginatedResult(units, total, page, limit);
  }

  async getGroupsByLeader(leaderId: string): Promise<{
    districtsAstor: GroupDocument[];
    districtsAsChamp: GroupDocument[];
    unitsAsHead: GroupDocument[];
  }> {
    const [districtsAsPastor, districtsAsChamp, unitsAsHead] =
      await Promise.all([
        this.groupModel.find({ districtPastor: leaderId, isActive: true }),
        this.groupModel.find({ champs: { $in: [leaderId] }, isActive: true }),
        this.groupModel.find({ unitHead: leaderId, isActive: true }),
      ]);

    return {
      districtsAstor: districtsAsPastor,
      districtsAsChamp,
      unitsAsHead,
    };
  }

  async deactivate(id: string): Promise<GroupDocument> {
    const group = await this.groupModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async activate(id: string): Promise<GroupDocument> {
    const group = await this.groupModel.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true },
    );

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async remove(id: string): Promise<void> {
    const result = await this.groupModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Group not found');
    }
  }

  // ============================================
  // NEW METHODS: Leadership, Bulk Members, Ministry-Unit Sync
  // ============================================

  // Assign Assistant Unit Head
  async assignAssistantUnitHead(
    groupId: string,
    memberId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.UNIT) {
      throw new BadRequestException(
        'Only units can have assistant unit heads',
      );
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $set: { assistantUnitHead: memberId } },
        { new: true },
      )
      .populate(
        'assistantUnitHead',
        'firstName lastName email phone membershipStatus',
      );

    return updatedGroup!;
  }

  // Remove Assistant Unit Head
  async removeAssistantUnitHead(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { assistantUnitHead: 1 } },
        { new: true },
      )
      .exec();

    return updatedGroup!;
  }

  // Assign Ministry Director
  async assignMinistryDirector(
    groupId: string,
    memberId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.MINISTRY) {
      throw new BadRequestException('Only ministries can have directors');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $set: { ministryDirector: memberId } },
        { new: true },
      )
      .populate(
        'ministryDirector',
        'firstName lastName email phone membershipStatus',
      );

    return updatedGroup!;
  }

  // Remove Ministry Director
  async removeMinistryDirector(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { ministryDirector: 1 } },
        { new: true },
      )
      .exec();

    return updatedGroup!;
  }

  // Bulk Add Members
  async addMembers(
    groupId: string,
    memberIds: string[],
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Filter out already-existing members
    const existingMemberIds = group.members.map((m) => m.toString());
    const newMemberIds = memberIds.filter(
      (id) => !existingMemberIds.includes(id),
    );

    if (newMemberIds.length === 0) {
      throw new ConflictException('All members are already in this group');
    }

    // Check capacity
    if (
      group.maxCapacity &&
      group.currentMemberCount + newMemberIds.length > group.maxCapacity
    ) {
      throw new BadRequestException(
        'Adding these members would exceed group capacity',
      );
    }

    // Add members
    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        {
          $addToSet: { members: { $each: newMemberIds } },
          $inc: { currentMemberCount: newMemberIds.length },
        },
        { new: true },
      )
      .populate(
        'members',
        'firstName lastName email phone membershipStatus dateJoined',
      );

    // If this is a unit linked to ministries, sync members to those ministries
    await this.syncMembersToLinkedMinistries(groupId, newMemberIds, 'add');

    return updatedGroup!;
  }

  // Set Default Role for Group
  async setDefaultRole(
    groupId: string,
    roleId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $set: { defaultRole: roleId } },
        { new: true },
      )
      .populate('defaultRole', 'name displayName slug');

    return updatedGroup!;
  }

  // Remove Default Role from Group
  async removeDefaultRole(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, { $unset: { defaultRole: 1 } }, { new: true })
      .exec();

    return updatedGroup!;
  }

  // Link Units to Ministry
  async linkUnitsToMinistry(
    ministryId: string,
    unitIds: string[],
  ): Promise<GroupDocument> {
    const ministry = await this.groupModel.findById(ministryId);
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }

    if (ministry.type !== GroupType.MINISTRY) {
      throw new BadRequestException('Only ministries can have linked units');
    }

    // Validate that all provided IDs are units
    const units = await this.groupModel.find({
      _id: { $in: unitIds },
      type: GroupType.UNIT,
      isActive: true,
    });

    if (units.length !== unitIds.length) {
      throw new BadRequestException(
        'Some of the provided IDs are not valid units',
      );
    }

    // Link the units
    const updatedMinistry = await this.groupModel
      .findByIdAndUpdate(
        ministryId,
        { $addToSet: { linkedUnits: { $each: unitIds } } },
        { new: true },
      )
      .populate('linkedUnits', 'name type currentMemberCount');

    // Sync all members from linked units to ministry
    for (const unit of units) {
      const unitMemberIds = unit.members.map((m) => m.toString());
      if (unitMemberIds.length > 0) {
        await this.groupModel.findByIdAndUpdate(ministryId, {
          $addToSet: { members: { $each: unitMemberIds } },
        });
      }
    }

    // Update member count
    const finalMinistry = await this.groupModel.findById(ministryId);
    if (finalMinistry) {
      await this.groupModel.findByIdAndUpdate(ministryId, {
        $set: { currentMemberCount: finalMinistry.members.length },
      });
    }

    return (await this.findById(ministryId))!;
  }

  // Unlink Units from Ministry
  async unlinkUnitsFromMinistry(
    ministryId: string,
    unitIds: string[],
  ): Promise<GroupDocument> {
    const ministry = await this.groupModel.findById(ministryId);
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }

    if (ministry.type !== GroupType.MINISTRY) {
      throw new BadRequestException('Only ministries can have linked units');
    }

    // Get members from units being unlinked
    const unitsToUnlink = await this.groupModel.find({
      _id: { $in: unitIds },
    });

    const membersToRemove = new Set<string>();
    for (const unit of unitsToUnlink) {
      unit.members.forEach((m) => membersToRemove.add(m.toString()));
    }

    // Get members from remaining linked units (they should stay in ministry)
    const remainingLinkedUnitIds = ministry.linkedUnits
      .filter((id) => !unitIds.includes(id.toString()))
      .map((id) => id.toString());

    const remainingUnits = await this.groupModel.find({
      _id: { $in: remainingLinkedUnitIds },
    });

    const membersToKeep = new Set<string>();
    for (const unit of remainingUnits) {
      unit.members.forEach((m) => membersToKeep.add(m.toString()));
    }

    // Only remove members that are not in any remaining linked unit
    const finalMembersToRemove = [...membersToRemove].filter(
      (m) => !membersToKeep.has(m),
    );

    // Unlink units and remove members
    await this.groupModel.findByIdAndUpdate(ministryId, {
      $pull: {
        linkedUnits: { $in: unitIds },
        members: { $in: finalMembersToRemove },
      },
    });

    // Update member count
    const finalMinistry = await this.groupModel.findById(ministryId);
    if (finalMinistry) {
      await this.groupModel.findByIdAndUpdate(ministryId, {
        $set: { currentMemberCount: finalMinistry.members.length },
      });
    }

    return (await this.findById(ministryId))!;
  }

  // Helper: Sync members to linked ministries when unit membership changes
  private async syncMembersToLinkedMinistries(
    unitId: string,
    memberIds: string[],
    action: 'add' | 'remove',
  ): Promise<void> {
    // Find all ministries that have this unit linked
    const linkedMinistries = await this.groupModel.find({
      type: GroupType.MINISTRY,
      linkedUnits: unitId,
      isActive: true,
    });

    for (const ministry of linkedMinistries) {
      if (action === 'add') {
        await this.groupModel.findByIdAndUpdate(ministry._id, {
          $addToSet: { members: { $each: memberIds } },
        });
      } else {
        // For removal, check if member is in any other linked unit
        for (const memberId of memberIds) {
          const isInOtherLinkedUnit = await this.groupModel.exists({
            _id: { $in: ministry.linkedUnits, $ne: unitId },
            members: memberId,
          });

          if (!isInOtherLinkedUnit) {
            await this.groupModel.findByIdAndUpdate(ministry._id, {
              $pull: { members: memberId },
            });
          }
        }
      }

      // Update member count
      const updatedMinistry = await this.groupModel.findById(ministry._id);
      if (updatedMinistry) {
        await this.groupModel.findByIdAndUpdate(ministry._id, {
          $set: { currentMemberCount: updatedMinistry.members.length },
        });
      }
    }
  }

  // Override removeMember to sync with linked ministries
  async removeMemberWithSync(
    groupId: string,
    memberId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        {
          $pull: { members: memberId },
          $inc: { currentMemberCount: -1 },
        },
        { new: true },
      )
      .populate('members', 'firstName lastName email phone');

    // If this is a unit, sync removal to linked ministries
    if (group.type === GroupType.UNIT) {
      await this.syncMembersToLinkedMinistries(groupId, [memberId], 'remove');
    }

    return updatedGroup!;
  }
}

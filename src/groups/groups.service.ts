import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupSearchDto } from './dto/group-search.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../common/utils/pagination.util';
import { QueryBuilder } from '../common/utils/query-builder.util';
import { GroupType } from '../common/enums/group-types.enum';
import { MembershipStatus } from '../common/enums/member-status.enum';
import {
  BranchAccessService,
  BranchFilterContext,
} from '../common/services/branch-access.service';
import { MemberLifecycleService } from '../activity-tracker/member-lifecycle.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private branchAccessService: BranchAccessService,
    @Inject(forwardRef(() => MemberLifecycleService))
    private memberLifecycleService: MemberLifecycleService,
    @Inject(forwardRef(() => QueueService))
    private queueService: QueueService,
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
    // Use aggregation with $lookup for reliable cross-collection joins
    const results = await this.groupModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      // Lookup members - handle both ObjectId and string IDs
      {
        $lookup: {
          from: 'members',
          let: { memberIds: '$members' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    '$_id',
                    {
                      $map: {
                        input: '$$memberIds',
                        as: 'mid',
                        in: { $toObjectId: '$$mid' },
                      },
                    },
                  ],
                },
              },
            },
            // Lookup the unit for each member
            {
              $lookup: {
                from: 'groups',
                localField: 'unit',
                foreignField: '_id',
                as: 'unitData',
              },
            },
            {
              $addFields: {
                unit: { $arrayElemAt: ['$unitData', 0] },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                membershipStatus: 1,
                dateJoined: 1,
                unit: { _id: 1, name: 1, type: 1 },
              },
            },
          ],
          as: 'members',
        },
      },
      // Lookup districtPastor - handle both ObjectId and string
      {
        $lookup: {
          from: 'members',
          let: { pastorId: '$districtPastor' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$pastorId' }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                membershipStatus: 1,
              },
            },
          ],
          as: 'districtPastorData',
        },
      },
      {
        $addFields: {
          districtPastor: { $arrayElemAt: ['$districtPastorData', 0] },
        },
      },
      // Lookup unitHead - handle both ObjectId and string
      {
        $lookup: {
          from: 'members',
          let: { headId: '$unitHead' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$headId' }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                membershipStatus: 1,
              },
            },
          ],
          as: 'unitHeadData',
        },
      },
      {
        $addFields: {
          unitHead: { $arrayElemAt: ['$unitHeadData', 0] },
        },
      },
      // Lookup assistantUnitHead - handle both ObjectId and string
      {
        $lookup: {
          from: 'members',
          let: { assistantId: '$assistantUnitHead' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$assistantId' }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                membershipStatus: 1,
              },
            },
          ],
          as: 'assistantUnitHeadData',
        },
      },
      {
        $addFields: {
          assistantUnitHead: { $arrayElemAt: ['$assistantUnitHeadData', 0] },
        },
      },
      // Lookup ministryDirector - handle both ObjectId and string
      {
        $lookup: {
          from: 'members',
          let: { directorId: '$ministryDirector' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$directorId' }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                phone: 1,
                membershipStatus: 1,
              },
            },
          ],
          as: 'ministryDirectorData',
        },
      },
      {
        $addFields: {
          ministryDirector: { $arrayElemAt: ['$ministryDirectorData', 0] },
        },
      },
      // Lookup linkedUnits
      {
        $lookup: {
          from: 'groups',
          localField: 'linkedUnits',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                type: 1,
                currentMemberCount: 1,
              },
            },
          ],
          as: 'linkedUnits',
        },
      },
      // Lookup defaultRole
      {
        $lookup: {
          from: 'roles',
          localField: 'defaultRole',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                displayName: 1,
                slug: 1,
              },
            },
          ],
          as: 'defaultRoleData',
        },
      },
      {
        $addFields: {
          defaultRole: { $arrayElemAt: ['$defaultRoleData', 0] },
        },
      },
      // Clean up temporary fields
      {
        $project: {
          districtPastorData: 0,
          unitHeadData: 0,
          assistantUnitHeadData: 0,
          ministryDirectorData: 0,
          defaultRoleData: 0,
        },
      },
    ]);

    return results.length > 0 ? (results[0] as GroupDocument) : null;
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
  async addMember(groupId: string, memberId: string, initiatedByUserId?: string): Promise<GroupDocument> {
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

    // Get member info for checking first assignment and status
    const member = await this.memberModel.findById(memberId);
    const isFirstUnitAssignment = group.type === GroupType.UNIT &&
      member && member.membershipStatus === MembershipStatus.MEMBER ? true : false;

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

    // If this is a unit, update member's unit field and membershipStatus to DC (unless already LXL or higher)
    const previousStatus = member?.membershipStatus;
    if (group.type === GroupType.UNIT) {
      const leadershipStatuses: string[] = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];

      const updateFields: any = {
        unit: new Types.ObjectId(groupId), // Set the member's unit reference
      };

      if (member && !leadershipStatuses.includes(member.membershipStatus)) {
        updateFields.membershipStatus = MembershipStatus.DC;
      }

      await this.memberModel.findByIdAndUpdate(memberId, { $set: updateFields });
    }

    // Log activity as side effect (async, non-blocking)
    if (initiatedByUserId) {
      // Use setImmediate to not block the response
      setImmediate(async () => {
        try {
          // Determine activity type based on group type
          let activityType: any = 'VOLUNTEER_ASSIGNMENT';
          let title = `Added to ${group.type}: ${group.name}`;

          if (group.type === GroupType.UNIT) {
            if (isFirstUnitAssignment) {
              activityType = 'DC_ENROLLMENT';
              title = 'DC Enrollment - Unit Assignment';
            } else {
              activityType = 'UNIT_ASSIGNMENT';
              title = 'Unit Assignment';
            }
          } else if (group.type === GroupType.DISTRICT) {
            activityType = 'DISTRICT_ASSIGNMENT';
            title = 'District Assignment';
          } else if (group.type === GroupType.MINISTRY) {
            activityType = 'MINISTRY_ASSIGNMENT';
            title = 'Ministry Assignment';
          }

          await this.memberLifecycleService.logLifecycleEvent({
            memberId,
            activityType,
            title,
            description: `Added to ${group.name}`,
            initiatedBy: initiatedByUserId,
            reason: `Added to ${group.type}: ${group.name}`,
            toUnit: group.type === GroupType.UNIT ? groupId : undefined,
            toDistrict: group.type === GroupType.DISTRICT ? groupId : undefined,
            tags: [group.type, 'assignment'],
          });
          this.logger.log(`[AddMember] Activity logged for member ${memberId} added to ${group.name}`);

          // If status changed to DC, also log the status change
          if (group.type === GroupType.UNIT && previousStatus === MembershipStatus.MEMBER) {
            await this.memberLifecycleService.logMembershipStatusChange(
              memberId,
              MembershipStatus.MEMBER,
              MembershipStatus.DC,
              initiatedByUserId,
              `Promoted to DC upon joining unit: ${group.name}`,
            );
            this.logger.log(`[AddMember] Status change logged for member ${memberId}`);
          }
        } catch (error) {
          this.logger.error(`[AddMember] Failed to log activity: ${error.message}`);
        }
      });
    }

    return updatedGroup!;
  }

  async removeMember(
    groupId: string,
    memberId: string,
    initiatedByUserId?: string,
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

    // If this is a unit, clear the member's unit reference
    if (group.type === GroupType.UNIT) {
      await this.memberModel.findByIdAndUpdate(memberId, {
        $unset: { unit: 1 },
      });
    }

    // Log activity as side effect (async, non-blocking)
    if (initiatedByUserId) {
      setImmediate(async () => {
        try {
          let activityType: any = 'COMMITTEE_REMOVAL';
          if (group.type === GroupType.UNIT) {
            activityType = 'UNIT_REMOVAL';
          } else if (group.type === GroupType.DISTRICT) {
            activityType = 'DISTRICT_REMOVAL';
          } else if (group.type === GroupType.MINISTRY) {
            activityType = 'MINISTRY_REMOVAL';
          }

          await this.memberLifecycleService.logLifecycleEvent({
            memberId,
            activityType,
            title: `Removed from ${group.type}: ${group.name}`,
            description: `Removed from ${group.name}`,
            initiatedBy: initiatedByUserId,
            reason: `Removed from ${group.type}`,
            fromUnit: group.type === GroupType.UNIT ? groupId : undefined,
            fromDistrict: group.type === GroupType.DISTRICT ? groupId : undefined,
            tags: [group.type, 'removal'],
          });
          this.logger.log(`[RemoveMember] Activity logged for member ${memberId} removed from ${group.name}`);
        } catch (error) {
          this.logger.error(`[RemoveMember] Failed to log activity: ${error.message}`);
        }
      });
    }

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

    // Check if member is already in the group
    const isAlreadyMember = group.members.some(
      (m) => m.toString() === pastorId,
    );

    // Build update object - assign as pastor and add to members if not already
    const updateObj: any = { $set: { districtPastor: pastorId } };
    if (!isAlreadyMember) {
      updateObj.$addToSet = { members: pastorId };
      updateObj.$inc = { currentMemberCount: 1 };
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, updateObj, { new: true })
      .populate('districtPastor', 'firstName lastName email phone');

    // Update membershipStatus to LXL
    await this.memberModel.findByIdAndUpdate(pastorId, {
      $set: { membershipStatus: MembershipStatus.LXL },
    });

    return updatedGroup!;
  }

  // Remove District Pastor
  async removeDistrictPastor(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Store the previous pastor's ID before removing
    const previousPastorId = group.districtPastor?.toString();

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { districtPastor: 1 } },
        { new: true },
      )
      .exec();

    // Check if the previous pastor has any other leadership roles, if not demote to DC
    if (previousPastorId) {
      await this.demoteToMemberIfNoLeadershipRoles(previousPastorId);
    }

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

    // Check if member is already in the group
    const isAlreadyMember = group.members.some(
      (m) => m.toString() === headId,
    );

    // Build update object - assign as unit head and add to members if not already
    const updateObj: any = { $set: { unitHead: headId } };
    if (!isAlreadyMember) {
      updateObj.$addToSet = { members: headId };
      updateObj.$inc = { currentMemberCount: 1 };
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, updateObj, { new: true })
      .populate('unitHead', 'firstName lastName email phone');

    // Sync to linked ministries if member was added
    if (!isAlreadyMember) {
      await this.syncMembersToLinkedMinistries(groupId, [headId], 'add');
    }

    // Update membershipStatus to LXL
    await this.memberModel.findByIdAndUpdate(headId, {
      $set: { membershipStatus: MembershipStatus.LXL },
    });

    return updatedGroup!;
  }

  // Remove Unit Head
  async removeUnitHead(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Store the previous unit head's ID before removing
    const previousHeadId = group.unitHead?.toString();

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { unitHead: 1 } },
        { new: true },
      )
      .exec();

    // Check if the previous head has any other leadership roles, if not demote to DC
    if (previousHeadId) {
      await this.demoteToMemberIfNoLeadershipRoles(previousHeadId);
    }

    return updatedGroup!;
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
    const [
      typeStats,
      leadershipStats,
      capacityStats,
      totalGroups,
      activeGroups,
      totalMembers,
    ] = await Promise.all([
      // Groups by type
      this.groupModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),

      // Leadership coverage - fixed to check all group types properly
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
                      {
                        $and: [
                          { $eq: ['$type', 'ministry'] },
                          { $ne: ['$ministryDirector', null] },
                        ],
                      },
                      // Fellowship and committee don't have specific leader fields
                      // so we don't count them as having leaders by default
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
            currentMemberCount: { $ifNull: ['$currentMemberCount', 0] },
            maxCapacity: 1,
            utilizationRate: {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: ['$currentMemberCount', 0] },
                    '$maxCapacity',
                  ],
                },
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

      // Active groups count
      this.groupModel.countDocuments({ isActive: true }),

      // Total members across all active groups
      this.groupModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalMembers: { $sum: { $ifNull: ['$currentMemberCount', 0] } },
          },
        },
      ]),
    ]);

    // Convert typeStats array to object for easier frontend access
    const typeCounts: Record<string, number> = {};
    typeStats.forEach((stat: { _id: string; count: number }) => {
      typeCounts[stat._id] = stat.count;
    });

    return {
      total: totalGroups,
      active: activeGroups,
      districts: typeCounts['district'] || 0,
      units: typeCounts['unit'] || 0,
      ministries: typeCounts['ministry'] || 0,
      fellowships: typeCounts['fellowship'] || 0,
      committees: typeCounts['committee'] || 0,
      totalMembers: totalMembers[0]?.totalMembers || 0,
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
    districtsAsPastor: GroupDocument[];
    unitsAsHead: GroupDocument[];
    unitsAsAssistant: GroupDocument[];
    ministriesAsDirector: GroupDocument[];
  }> {
    const [districtsAsPastor, unitsAsHead, unitsAsAssistant, ministriesAsDirector] =
      await Promise.all([
        this.groupModel.find({ districtPastor: leaderId, isActive: true }),
        this.groupModel.find({ unitHead: leaderId, isActive: true }),
        this.groupModel.find({ assistantUnitHead: leaderId, isActive: true }),
        this.groupModel.find({ ministryDirector: leaderId, isActive: true }),
      ]);

    return {
      districtsAsPastor,
      unitsAsHead,
      unitsAsAssistant,
      ministriesAsDirector,
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

    // Check if member is already in the group
    const isAlreadyMember = group.members.some(
      (m) => m.toString() === memberId,
    );

    // Build update object - assign as assistant and add to members if not already
    const updateObj: any = { $set: { assistantUnitHead: memberId } };
    if (!isAlreadyMember) {
      updateObj.$addToSet = { members: memberId };
      updateObj.$inc = { currentMemberCount: 1 };
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, updateObj, { new: true })
      .populate(
        'assistantUnitHead',
        'firstName lastName email phone membershipStatus',
      );

    // Sync to linked ministries if member was added
    if (!isAlreadyMember) {
      await this.syncMembersToLinkedMinistries(groupId, [memberId], 'add');
    }

    // Update membershipStatus to LXL
    await this.memberModel.findByIdAndUpdate(memberId, {
      $set: { membershipStatus: MembershipStatus.LXL },
    });

    return updatedGroup!;
  }

  // Remove Assistant Unit Head
  async removeAssistantUnitHead(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Store the previous assistant's ID before removing
    const previousAssistantId = group.assistantUnitHead?.toString();

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { assistantUnitHead: 1 } },
        { new: true },
      )
      .exec();

    // Check if the previous assistant has any other leadership roles, if not demote to DC
    if (previousAssistantId) {
      await this.demoteToMemberIfNoLeadershipRoles(previousAssistantId);
    }

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

    // Check if member is already in the group
    const isAlreadyMember = group.members.some(
      (m) => m.toString() === memberId,
    );

    // Build update object - assign as director and add to members if not already
    const updateObj: any = { $set: { ministryDirector: memberId } };
    if (!isAlreadyMember) {
      updateObj.$addToSet = { members: memberId };
      updateObj.$inc = { currentMemberCount: 1 };
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(groupId, updateObj, { new: true })
      .populate(
        'ministryDirector',
        'firstName lastName email phone membershipStatus',
      );

    // Update membershipStatus to LXL
    await this.memberModel.findByIdAndUpdate(memberId, {
      $set: { membershipStatus: MembershipStatus.LXL },
    });

    return updatedGroup!;
  }

  // Remove Ministry Director
  async removeMinistryDirector(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Store the previous director's ID before removing
    const previousDirectorId = group.ministryDirector?.toString();

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(
        groupId,
        { $unset: { ministryDirector: 1 } },
        { new: true },
      )
      .exec();

    // Check if the previous director has any other leadership roles, if not demote to DC
    if (previousDirectorId) {
      await this.demoteToMemberIfNoLeadershipRoles(previousDirectorId);
    }

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

    // If this is a unit, update members' unit field and membershipStatus to DC (unless already LXL or higher)
    if (group.type === GroupType.UNIT) {
      const leadershipStatuses: string[] = [
        MembershipStatus.LXL,
        MembershipStatus.DIRECTOR,
        MembershipStatus.PASTOR,
        MembershipStatus.CAMPUS_PASTOR,
        MembershipStatus.SENIOR_PASTOR,
      ];

      const unitObjectId = new Types.ObjectId(groupId);

      // Update unit field for all new members
      await this.memberModel.updateMany(
        { _id: { $in: newMemberIds } },
        { $set: { unit: unitObjectId } },
      );

      // Update membershipStatus to DC for members who are not already leaders
      await this.memberModel.updateMany(
        {
          _id: { $in: newMemberIds },
          membershipStatus: { $nin: leadershipStatuses },
        },
        { $set: { membershipStatus: MembershipStatus.DC } },
      );
    }

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

    // Link the units - convert string IDs to ObjectIds
    const unitObjectIds = unitIds.map((id) => new Types.ObjectId(id));
    const updatedMinistry = await this.groupModel
      .findByIdAndUpdate(
        ministryId,
        { $addToSet: { linkedUnits: { $each: unitObjectIds } } },
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

    // Get all members from units being unlinked
    const unitsToUnlink = await this.groupModel.find({
      _id: { $in: unitIds.map((id) => new Types.ObjectId(id)) },
    });

    // Collect all member IDs from units being unlinked
    const membersToRemove: Types.ObjectId[] = [];
    for (const unit of unitsToUnlink) {
      for (const memberId of unit.members) {
        membersToRemove.push(
          typeof memberId === 'string' ? new Types.ObjectId(memberId) : memberId,
        );
      }
    }

    // Unlink units and remove all their members from the ministry
    const unitObjectIds = unitIds.map((id) => new Types.ObjectId(id));
    await this.groupModel.findByIdAndUpdate(ministryId, {
      $pull: {
        linkedUnits: { $in: unitObjectIds },
        members: { $in: membersToRemove },
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
    const unitObjectId = new Types.ObjectId(unitId);
    const linkedMinistries = await this.groupModel.find({
      type: GroupType.MINISTRY,
      linkedUnits: unitObjectId,
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
            _id: { $in: ministry.linkedUnits, $ne: unitObjectId },
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

    // If this is a unit, clear the member's unit reference and sync removal to linked ministries
    if (group.type === GroupType.UNIT) {
      await this.memberModel.findByIdAndUpdate(memberId, {
        $unset: { unit: 1 },
      });
      await this.syncMembersToLinkedMinistries(groupId, [memberId], 'remove');
    }

    return updatedGroup!;
  }

  // Helper: Check if member has any leadership roles, if not demote to DC
  private async demoteToMemberIfNoLeadershipRoles(memberId: string): Promise<void> {
    try {
      // Check all leadership positions across all groups
      const leadershipRoles = await this.getGroupsByLeader(memberId);

      const totalLeadershipRoles =
        leadershipRoles.districtsAsPastor.length +
        leadershipRoles.unitsAsHead.length +
        leadershipRoles.unitsAsAssistant.length +
        leadershipRoles.ministriesAsDirector.length;

      // If member has no other leadership roles, demote to DC
      if (totalLeadershipRoles === 0) {
        const member = await this.memberModel.findById(memberId);
        if (member) {
          const previousStatus = member.membershipStatus;

          // Only demote if currently in a leadership status
          const leadershipStatuses: string[] = [
            MembershipStatus.LXL,
            MembershipStatus.DIRECTOR,
          ];

          if (leadershipStatuses.includes(member.membershipStatus)) {
            await this.memberModel.findByIdAndUpdate(memberId, {
              $set: { membershipStatus: MembershipStatus.DC },
            });

            // Log the status change in timeline
            try {
              await this.memberLifecycleService.logMembershipStatusChange(
                memberId,
                previousStatus,
                MembershipStatus.DC,
                memberId,
                'Removed from leadership role',
              );
            } catch (error) {
              this.logger.warn(`Failed to log leadership demotion to timeline: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error checking leadership roles for member ${memberId}: ${error.message}`);
    }
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  RoleAssignment,
  RoleAssignmentDocument,
  ScopeType,
} from '../schemas/role-assignment.schema';
import {
  CreateRoleAssignmentDto,
  UpdateRoleAssignmentDto,
  RoleAssignmentQueryDto,
  BulkRoleAssignmentDto,
} from '../dto/role-assignment.dto';
import { RolesService } from './roles.service';

@Injectable()
export class RoleAssignmentService {
  private readonly logger = new Logger(RoleAssignmentService.name);

  constructor(
    @InjectModel(RoleAssignment.name)
    private roleAssignmentModel: Model<RoleAssignmentDocument>,
    private rolesService: RolesService,
  ) {}

  /**
   * Create a new role assignment
   */
  async create(
    createDto: CreateRoleAssignmentDto,
    assignedById?: string,
  ): Promise<RoleAssignmentDocument> {
    // Validate role exists
    const role = await this.rolesService.findById(createDto.roleId);
    if (!role) {
      throw new NotFoundException(`Role with ID ${createDto.roleId} not found`);
    }

    // Validate scope requirements
    if (createDto.scopeType !== ScopeType.GLOBAL && !createDto.scopeId) {
      throw new BadRequestException(
        `scopeId is required for scopeType '${createDto.scopeType}'`,
      );
    }

    // Determine the ref model based on scope type
    let scopeRefModel: string | undefined;
    if (createDto.scopeType === ScopeType.BRANCH) {
      scopeRefModel = 'Branch';
    } else if (
      [ScopeType.DISTRICT, ScopeType.UNIT, ScopeType.GROUP].includes(
        createDto.scopeType,
      )
    ) {
      scopeRefModel = 'Group';
    }

    // Check for existing active assignment with same role + scope
    const existing = await this.roleAssignmentModel.findOne({
      member: new Types.ObjectId(createDto.memberId),
      role: new Types.ObjectId(createDto.roleId),
      scopeType: createDto.scopeType,
      scopeId: createDto.scopeId
        ? new Types.ObjectId(createDto.scopeId)
        : undefined,
      isActive: true,
    });

    if (existing) {
      throw new ConflictException(
        'Member already has an active assignment for this role and scope',
      );
    }

    // If this is marked as primary, unset other primary assignments for this member
    if (createDto.isPrimary) {
      await this.roleAssignmentModel.updateMany(
        {
          member: new Types.ObjectId(createDto.memberId),
          isPrimary: true,
          isActive: true,
        },
        { $set: { isPrimary: false } },
      );
    }

    const assignment = new this.roleAssignmentModel({
      member: new Types.ObjectId(createDto.memberId),
      role: new Types.ObjectId(createDto.roleId),
      scopeType: createDto.scopeType,
      scopeId: createDto.scopeId
        ? new Types.ObjectId(createDto.scopeId)
        : undefined,
      scopeRefModel,
      additionalScopeIds: (createDto.additionalScopeIds || []).map(
        (id) => new Types.ObjectId(id),
      ),
      assignedBy: assignedById
        ? new Types.ObjectId(assignedById)
        : undefined,
      isPrimary: createDto.isPrimary || false,
      expiresAt: createDto.expiresAt
        ? new Date(createDto.expiresAt)
        : undefined,
      notes: createDto.notes,
      metadata: createDto.metadata || {},
    });

    const saved = await assignment.save();
    this.logger.log(
      `Created role assignment: member=${createDto.memberId}, role=${createDto.roleId}, scope=${createDto.scopeType}`,
    );

    return this.findById((saved._id as Types.ObjectId).toString());
  }

  /**
   * Find role assignment by ID
   */
  async findById(id: string): Promise<RoleAssignmentDocument> {
    const assignment = await this.roleAssignmentModel
      .findById(id)
      .populate('member', 'firstName lastName email')
      .populate('role', 'name displayName level')
      .populate('scopeId')
      .populate('assignedBy', 'firstName lastName')
      .exec();

    if (!assignment) {
      throw new NotFoundException(`Role assignment with ID ${id} not found`);
    }

    return assignment;
  }

  /**
   * Find all role assignments with optional filters
   */
  async findAll(
    queryDto: RoleAssignmentQueryDto = {},
  ): Promise<RoleAssignmentDocument[]> {
    const filter: FilterQuery<RoleAssignmentDocument> = {};

    if (queryDto.memberId) {
      filter.member = new Types.ObjectId(queryDto.memberId);
    }
    if (queryDto.roleId) {
      filter.role = new Types.ObjectId(queryDto.roleId);
    }
    if (queryDto.scopeType) {
      filter.scopeType = queryDto.scopeType;
    }
    if (queryDto.scopeId) {
      filter.scopeId = new Types.ObjectId(queryDto.scopeId);
    }
    if (queryDto.isActive !== undefined) {
      filter.isActive = queryDto.isActive;
    } else {
      filter.isActive = true; // Default to active only
    }
    if (queryDto.isPrimary !== undefined) {
      filter.isPrimary = queryDto.isPrimary;
    }

    // Exclude expired assignments unless explicitly requested
    if (!queryDto.includeExpired) {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ];
    }

    return this.roleAssignmentModel
      .find(filter)
      .populate('member', 'firstName lastName email')
      .populate('role', 'name displayName level')
      .populate('scopeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get all role assignments for a member
   */
  async getMemberAssignments(
    memberId: string,
    activeOnly: boolean = true,
  ): Promise<RoleAssignmentDocument[]> {
    const filter: FilterQuery<RoleAssignmentDocument> = {
      member: new Types.ObjectId(memberId),
    };

    if (activeOnly) {
      filter.isActive = true;
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ];
    }

    return this.roleAssignmentModel
      .find(filter)
      .populate('role', 'name displayName level permissions')
      .populate('scopeId')
      .sort({ isPrimary: -1, createdAt: -1 })
      .exec();
  }

  /**
   * Get the primary role assignment for a member
   */
  async getMemberPrimaryAssignment(
    memberId: string,
  ): Promise<RoleAssignmentDocument | null> {
    return this.roleAssignmentModel
      .findOne({
        member: new Types.ObjectId(memberId),
        isPrimary: true,
        isActive: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      })
      .populate('role', 'name displayName level permissions')
      .populate('scopeId')
      .exec();
  }

  /**
   * Get all members assigned to a specific role within a scope
   */
  async getMembersWithRole(
    roleId: string,
    scopeType?: ScopeType,
    scopeId?: string,
  ): Promise<RoleAssignmentDocument[]> {
    const filter: FilterQuery<RoleAssignmentDocument> = {
      role: new Types.ObjectId(roleId),
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    };

    if (scopeType) {
      filter.scopeType = scopeType;
    }
    if (scopeId) {
      filter.$or = [
        { scopeId: new Types.ObjectId(scopeId) },
        { additionalScopeIds: new Types.ObjectId(scopeId) },
      ];
    }

    return this.roleAssignmentModel
      .find(filter)
      .populate('member', 'firstName lastName email phone')
      .populate('role', 'name displayName')
      .exec();
  }

  /**
   * Get all members with access to a specific scope (branch, district, etc.)
   */
  async getMembersWithScopeAccess(
    scopeType: ScopeType,
    scopeId: string,
  ): Promise<RoleAssignmentDocument[]> {
    return this.roleAssignmentModel
      .find({
        isActive: true,
        $or: [
          { scopeType: ScopeType.GLOBAL }, // Global access includes all scopes
          {
            scopeType: scopeType,
            $or: [
              { scopeId: new Types.ObjectId(scopeId) },
              { additionalScopeIds: new Types.ObjectId(scopeId) },
            ],
          },
        ],
        $and: [
          {
            $or: [
              { expiresAt: { $exists: false } },
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } },
            ],
          },
        ],
      })
      .populate('member', 'firstName lastName email')
      .populate('role', 'name displayName level')
      .exec();
  }

  /**
   * Check if a member has access to a specific scope
   */
  async memberHasScopeAccess(
    memberId: string,
    scopeType: ScopeType,
    scopeId: string,
  ): Promise<boolean> {
    const count = await this.roleAssignmentModel.countDocuments({
      member: new Types.ObjectId(memberId),
      isActive: true,
      $or: [
        { scopeType: ScopeType.GLOBAL },
        {
          scopeType: scopeType,
          $or: [
            { scopeId: new Types.ObjectId(scopeId) },
            { additionalScopeIds: new Types.ObjectId(scopeId) },
          ],
        },
      ],
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      ],
    });

    return count > 0;
  }

  /**
   * Get the access scope filter for a member (used for data filtering)
   */
  async getMemberAccessFilter(memberId: string): Promise<{
    hasGlobalAccess: boolean;
    branchIds: string[];
    districtIds: string[];
    unitIds: string[];
    groupIds: string[];
  }> {
    const assignments = await this.getMemberAssignments(memberId, true);

    const result = {
      hasGlobalAccess: false,
      branchIds: [] as string[],
      districtIds: [] as string[],
      unitIds: [] as string[],
      groupIds: [] as string[],
    };

    for (const assignment of assignments) {
      if (assignment.scopeType === ScopeType.GLOBAL) {
        result.hasGlobalAccess = true;
        break; // Global access means no filtering needed
      }

      const scopeIds = [
        assignment.scopeId?.toString(),
        ...(assignment.additionalScopeIds || []).map((id) => id.toString()),
      ].filter(Boolean) as string[];

      switch (assignment.scopeType) {
        case ScopeType.BRANCH:
          result.branchIds.push(...scopeIds);
          break;
        case ScopeType.DISTRICT:
          result.districtIds.push(...scopeIds);
          break;
        case ScopeType.UNIT:
          result.unitIds.push(...scopeIds);
          break;
        case ScopeType.GROUP:
          result.groupIds.push(...scopeIds);
          break;
      }
    }

    // Remove duplicates
    result.branchIds = [...new Set(result.branchIds)];
    result.districtIds = [...new Set(result.districtIds)];
    result.unitIds = [...new Set(result.unitIds)];
    result.groupIds = [...new Set(result.groupIds)];

    return result;
  }

  /**
   * Update a role assignment
   */
  async update(
    id: string,
    updateDto: UpdateRoleAssignmentDto,
  ): Promise<RoleAssignmentDocument> {
    const assignment = await this.roleAssignmentModel.findById(id);
    if (!assignment) {
      throw new NotFoundException(`Role assignment with ID ${id} not found`);
    }

    // If setting as primary, unset other primary assignments
    if (updateDto.isPrimary === true) {
      await this.roleAssignmentModel.updateMany(
        {
          member: assignment.member,
          _id: { $ne: new Types.ObjectId(id) },
          isPrimary: true,
          isActive: true,
        },
        { $set: { isPrimary: false } },
      );
    }

    const updateData: any = { ...updateDto };
    if (updateDto.additionalScopeIds) {
      updateData.additionalScopeIds = updateDto.additionalScopeIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (updateDto.expiresAt) {
      updateData.expiresAt = new Date(updateDto.expiresAt);
    }

    await this.roleAssignmentModel.findByIdAndUpdate(id, {
      $set: updateData,
    });

    return this.findById(id);
  }

  /**
   * Deactivate a role assignment (soft delete)
   */
  async deactivate(id: string): Promise<RoleAssignmentDocument> {
    const assignment = await this.roleAssignmentModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false, isPrimary: false } },
      { new: true },
    );

    if (!assignment) {
      throw new NotFoundException(`Role assignment with ID ${id} not found`);
    }

    this.logger.log(`Deactivated role assignment: ${id}`);
    return assignment;
  }

  /**
   * Delete a role assignment (hard delete)
   */
  async delete(id: string): Promise<void> {
    const result = await this.roleAssignmentModel.deleteOne({
      _id: new Types.ObjectId(id),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Role assignment with ID ${id} not found`);
    }

    this.logger.log(`Deleted role assignment: ${id}`);
  }

  /**
   * Bulk assign a role to multiple members
   */
  async bulkAssign(
    bulkDto: BulkRoleAssignmentDto,
    assignedById?: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const memberId of bulkDto.memberIds) {
      try {
        await this.create(
          {
            memberId,
            roleId: bulkDto.roleId,
            scopeType: bulkDto.scopeType,
            scopeId: bulkDto.scopeId,
          },
          assignedById,
        );
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Member ${memberId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Transfer all role assignments from one member to another
   */
  async transferAssignments(
    fromMemberId: string,
    toMemberId: string,
  ): Promise<number> {
    const result = await this.roleAssignmentModel.updateMany(
      { member: new Types.ObjectId(fromMemberId), isActive: true },
      { $set: { member: new Types.ObjectId(toMemberId) } },
    );

    this.logger.log(
      `Transferred ${result.modifiedCount} role assignments from ${fromMemberId} to ${toMemberId}`,
    );

    return result.modifiedCount;
  }

  /**
   * Remove all assignments for a member (used when deleting a member)
   */
  async removeAllMemberAssignments(memberId: string): Promise<number> {
    const result = await this.roleAssignmentModel.updateMany(
      { member: new Types.ObjectId(memberId) },
      { $set: { isActive: false } },
    );

    return result.modifiedCount;
  }
}

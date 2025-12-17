import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryMovementService } from './inventory-movement.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { InventoryPermission } from './permissions';
import { UserRole } from '../common/enums/user-roles.enums';
import { Audit } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { InventoryMovementType } from '../common/enums/inventory.enum';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { InventoryMovementValidator } from './validators/inventory-movement.validator';

@ApiTags('inventory-movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('inventory/movements')
export class InventoryMovementController {
  constructor(
    private readonly movementService: InventoryMovementService,
    private readonly movementValidator: InventoryMovementValidator,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Post()
  @RequirePermission(InventoryPermission.RECORD_MOVEMENT)
  @Audit({
    action: AuditAction.CREATE,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Created inventory movement',
    severity: 'medium',
  })
  @ApiOperation({ summary: 'Create new inventory movement' })
  @ApiResponse({ status: 201, description: 'Movement created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid movement data' })
  async create(
    @Body() createMovementDto: CreateInventoryMovementDto,
    @Req() req: any,
  ) {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      // Validate movement type permissions
      const user = req.user;

      // For transfers, validate the user has access to the involved units/districts
      if (createMovementDto.movementType === InventoryMovementType.TRANSFER) {
        const hasFromAccess =
          (createMovementDto.fromUnit &&
            createMovementDto.fromUnit === user.unit?.toString()) ||
          (createMovementDto.fromDistrict &&
            user.leadershipRoles?.pastorsDistrict &&
            createMovementDto.fromDistrict ===
              user.leadershipRoles.pastorsDistrict.toString());

        if (!hasFromAccess) {
          throw new BadRequestException(
            'Insufficient permissions for source location',
          );
        }
      }

      // Set default status
      if (!createMovementDto.status) {
        createMovementDto.status = 'pending';
      }

      const movement = await this.movementService.processMovement(
        createMovementDto,
        user,
        session,
      );

      await session.commitTransaction();

      return movement;
    } catch (error) {
      await session.abortTransaction();
      throw new HttpException(
        error.message || 'Failed to create inventory movement',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      session.endSession();
    }
  }

  @Get()
  @RequirePermission(InventoryPermission.VIEW_MOVEMENTS)
  @ApiOperation({ summary: 'Get inventory movements with filtering' })
  @ApiResponse({ status: 200, description: 'Movements retrieved successfully' })
  async findAll(
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('movementType') movementType?: InventoryMovementType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('performedBy') performedBy?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Req() req?: any,
  ) {
    try {
      const user = req.user;
      let unitId: string | undefined;
      let districtId: string | undefined;

      // Apply access control filters based on user's assignments
      if (user.leadershipRoles?.pastorsDistrict) {
        districtId = user.leadershipRoles.pastorsDistrict;
      } else if (user.unit) {
        unitId = user.unit;
      }

      const filters = {
        movementType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        performedBy,
        status,
        unitId,
        districtId,
        page: page ? parseInt(page.toString()) : 1,
        limit: limit ? parseInt(limit.toString()) : 20,
        sortBy: sortBy || 'movementDate',
        sortOrder: sortOrder || 'desc',
      };

      return await this.movementService.findAll(inventoryItemId, filters);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve inventory movements',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @RequirePermission(InventoryPermission.VIEW_MOVEMENT_STATS)
  @ApiOperation({ summary: 'Get movement statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Req() req?: any,
  ) {
    try {
      const user = req.user;
      let unitId: string | undefined;
      let districtId: string | undefined;

      // Apply access control filters based on user's assignments
      if (user.leadershipRoles?.pastorsDistrict) {
        districtId = user.leadershipRoles.pastorsDistrict;
      } else if (user.unit) {
        unitId = user.unit;
      }

      const filters = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        unitId,
        districtId,
      };

      return await this.movementService.getMovementStatistics(
        inventoryItemId,
        filters,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve movement statistics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @RequirePermission(InventoryPermission.VIEW_MOVEMENT_DETAILS)
  @Audit({
    action: AuditAction.VIEW,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Viewed inventory movement',
    severity: 'low',
  })
  @ApiOperation({ summary: 'Get movement by ID' })
  @ApiResponse({ status: 200, description: 'Movement retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Movement not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    try {
      const movement = await this.movementService.findOne(id);
      const user = req.user;

      // Check access permissions based on user's assignments
      const hasAccess =
        movement.performedBy?._id?.toString() === user._id.toString() ||
        (user.leadershipRoles?.pastorsDistrict &&
          (movement.fromDistrict?.toString() ===
            user.leadershipRoles.pastorsDistrict.toString() ||
            movement.toDistrict?.toString() ===
              user.leadershipRoles.pastorsDistrict.toString())) ||
        movement.fromUnit?.toString() === user.unit?.toString() ||
        movement.toUnit?.toString() === user.unit?.toString();

      if (!hasAccess) {
        throw new HttpException(
          'Insufficient permissions',
          HttpStatus.FORBIDDEN,
        );
      }

      return movement;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve movement',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/approve')
  @RequirePermission(InventoryPermission.APPROVE_MOVEMENT)
  @Audit({
    action: AuditAction.UPDATE,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Approved inventory movement',
    severity: 'medium',
  })
  @ApiOperation({ summary: 'Approve pending movement' })
  @ApiResponse({ status: 200, description: 'Movement approved successfully' })
  @ApiResponse({ status: 404, description: 'Movement not found' })
  async approve(@Param('id') id: string, @Req() req: any) {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const movement = await this.movementService.approveMovement(
        id,
        req.user,
        session,
      );

      await session.commitTransaction();

      return movement;
    } catch (error) {
      await session.abortTransaction();
      throw new HttpException(
        error.message || 'Failed to approve movement',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      session.endSession();
    }
  }

  @Patch(':id/reject')
  @RequirePermission(InventoryPermission.REJECT_MOVEMENT)
  @Audit({
    action: AuditAction.UPDATE,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Rejected inventory movement',
    severity: 'high',
  })
  @ApiOperation({ summary: 'Reject pending movement' })
  @ApiResponse({ status: 200, description: 'Movement rejected successfully' })
  @ApiResponse({ status: 404, description: 'Movement not found' })
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      await this.movementService.rejectMovement(id, req.user, reason, session);

      await session.commitTransaction();

      return { message: 'Movement rejected successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw new HttpException(
        error.message || 'Failed to reject movement',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      session.endSession();
    }
  }

  @Get(':inventoryItemId/constraints')
  @RequirePermission(InventoryPermission.VIEW_MOVEMENT_CONSTRAINTS)
  @ApiOperation({ summary: 'Get movement constraints for inventory item' })
  @ApiResponse({
    status: 200,
    description: 'Constraints retrieved successfully',
  })
  async getMovementConstraints(
    @Param('inventoryItemId') inventoryItemId: string,
  ) {
    try {
      return await this.movementValidator.getMovementConstraints(
        inventoryItemId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve movement constraints',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

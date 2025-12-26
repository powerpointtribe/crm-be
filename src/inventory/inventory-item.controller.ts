import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryItemService } from './inventory-item.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { InventoryPermission } from './permissions';
import { Audit } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { PermissionService } from '../common/services/permission.service';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { BranchFilterContext } from '../common/services/branch-access.service';

@ApiTags('inventory-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('inventory/items')
export class InventoryItemController {
  constructor(
    private readonly inventoryItemService: InventoryItemService,
    private readonly permissionService: PermissionService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  @Post()
  @RequirePermission(InventoryPermission.CREATE_ITEM)
  @Audit({
    action: AuditAction.INVENTORY_ITEM_CREATED,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Created inventory item',
  })
  @ApiOperation({ summary: 'Create new inventory item' })
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  async create(
    @Body() createInventoryItemDto: CreateInventoryItemDto,
    @Req() req: any,
  ) {
    try {
      return await this.inventoryItemService.create(
        createInventoryItemDto,
        req.user,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create inventory item',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @RequirePermission(InventoryPermission.VIEW_ITEMS)
  @ApiOperation({ summary: 'Get all inventory items with filtering' })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  async findAll(@Query() queryDto: InventoryQueryDto, @Req() req: any) {
    try {
      const user = req.user;

      // Build branch filter context based on user's permissions
      let branchFilterContext: BranchFilterContext | undefined;

      if (user.role) {
        const userPermissions = await this.userPermissionsService.getUserPermissions(
          user.role._id || user.role,
        );
        branchFilterContext = {
          userPermissions: userPermissions.permissions,
          userBranchId: user.branch?._id || user.branch,
          selectedBranchId: queryDto.branchId,
        };
      } else {
        branchFilterContext = {
          userPermissions: [],
          userBranchId: user.branch?._id || user.branch,
        };
      }

      return await this.inventoryItemService.findAll(queryDto, branchFilterContext);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve inventory items',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @RequirePermission(InventoryPermission.VIEW_INVENTORY_STATS)
  @ApiOperation({ summary: 'Get inventory statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(@Req() req: any) {
    try {
      const user = req.user;
      const filters = this.permissionService.getListAccessFilters(user);

      return await this.inventoryItemService.getInventoryStatistics(
        filters.unitId,
        filters.districtId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve inventory statistics',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('low-stock')
  @RequirePermission(InventoryPermission.VIEW_LOW_STOCK)
  @ApiOperation({ summary: 'Get low stock items' })
  @ApiResponse({
    status: 200,
    description: 'Low stock items retrieved successfully',
  })
  async getLowStockItems(@Req() req: any) {
    try {
      const user = req.user;
      const filters = this.permissionService.getListAccessFilters(user);

      return await this.inventoryItemService.getLowStockItems(
        filters.unitId,
        filters.districtId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve low stock items',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('expiring')
  @RequirePermission(InventoryPermission.VIEW_EXPIRING_ITEMS)
  @ApiOperation({ summary: 'Get expiring items' })
  @ApiResponse({
    status: 200,
    description: 'Expiring items retrieved successfully',
  })
  async getExpiringItems(@Query('days') days: number = 30, @Req() req: any) {
    try {
      const user = req.user;
      const filters = this.permissionService.getListAccessFilters(user);

      return await this.inventoryItemService.getExpiringItems(
        days,
        filters.unitId,
        filters.districtId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve expiring items',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @RequirePermission(InventoryPermission.VIEW_ITEM_DETAILS)
  @Audit({
    action: AuditAction.VIEW,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Viewed inventory item',
    severity: 'low',
  })
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    try {
      const item = await this.inventoryItemService.findOne(id);
      const user = req.user;

      const accessResult = this.permissionService.checkResourceAccess({
        user,
        resourceUnitId: item.assignedUnit?.toString(),
        resourceDistrictId: item.assignedDistrict?.toString(),
      });

      if (!accessResult.hasAccess) {
        throw new HttpException(
          accessResult.reason || 'Insufficient permissions',
          HttpStatus.FORBIDDEN,
        );
      }

      return item;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve inventory item',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @RequirePermission(InventoryPermission.UPDATE_ITEM)
  @Audit({
    action: AuditAction.INVENTORY_ITEM_UPDATED,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Updated inventory item',
  })
  @ApiOperation({ summary: 'Update inventory item' })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryItemDto>,
    @Req() req: any,
  ) {
    try {
      return await this.inventoryItemService.update(id, updateData, req.user);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update inventory item',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @RequirePermission(InventoryPermission.DELETE_ITEM)
  @Audit({
    action: AuditAction.INVENTORY_ITEM_DELETED,
    entity: AuditEntity.INVENTORY_ITEM,
    description: 'Deleted inventory item',
    severity: 'high',
  })
  @ApiOperation({ summary: 'Delete inventory item' })
  @ApiResponse({ status: 200, description: 'Item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async remove(@Param('id') id: string, @Req() req: any) {
    try {
      await this.inventoryItemService.remove(id, req.user);
      return { message: 'Inventory item deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete inventory item',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

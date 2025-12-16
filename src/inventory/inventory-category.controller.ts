import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { InventoryCategoryService } from './inventory-category.service';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { InventoryPermission } from './permissions';
import { Audit } from '../common/decorators/audit.decorator';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@ApiTags('inventory-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('inventory/categories')
export class InventoryCategoryController {
  constructor(
    private readonly inventoryCategoryService: InventoryCategoryService,
  ) {}

  @Post()
  @RequirePermission(InventoryPermission.CREATE_CATEGORY)
  @Audit({
    action: AuditAction.CREATE,
    entity: AuditEntity.INVENTORY_CATEGORY,
    description: 'Created inventory category',
  })
  @ApiOperation({ summary: 'Create new inventory category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  async create(
    @Body() createInventoryCategoryDto: CreateInventoryCategoryDto,
    @Req() req: any,
  ) {
    try {
      return await this.inventoryCategoryService.create(
        createInventoryCategoryDto,
        req.user._id,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create category',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @RequirePermission(InventoryPermission.VIEW_CATEGORIES)
  @ApiOperation({ summary: 'Get all inventory categories' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  async findAll() {
    try {
      return await this.inventoryCategoryService.findAll();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve categories',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('hierarchy')
  @RequirePermission(InventoryPermission.VIEW_CATEGORY_HIERARCHY)
  @ApiOperation({ summary: 'Get category hierarchy' })
  @ApiResponse({
    status: 200,
    description: 'Category hierarchy retrieved successfully',
  })
  async getHierarchy() {
    try {
      return await this.inventoryCategoryService.getHierarchy();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve category hierarchy',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @RequirePermission(InventoryPermission.VIEW_CATEGORY_DETAILS)
  @ApiOperation({ summary: 'Get inventory category by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id') id: string) {
    try {
      return await this.inventoryCategoryService.findOne(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve category',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @RequirePermission(InventoryPermission.UPDATE_CATEGORY)
  @Audit({
    action: AuditAction.UPDATE,
    entity: AuditEntity.INVENTORY_CATEGORY,
    description: 'Updated inventory category',
  })
  @ApiOperation({ summary: 'Update inventory category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateInventoryCategoryDto>,
    @Req() req: any,
  ) {
    try {
      return await this.inventoryCategoryService.update(
        id,
        updateData,
        req.user._id,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update category',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @RequirePermission(InventoryPermission.DELETE_CATEGORY)
  @Audit({
    action: AuditAction.DELETE,
    entity: AuditEntity.INVENTORY_CATEGORY,
    description: 'Deleted inventory category',
    severity: 'high',
  })
  @ApiOperation({ summary: 'Delete inventory category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id') id: string) {
    try {
      await this.inventoryCategoryService.remove(id);
      return { message: 'Category deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete category',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

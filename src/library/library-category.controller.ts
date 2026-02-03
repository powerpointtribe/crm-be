import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { LibraryCategoryService } from './library-category.service';
import { CreateBookCategoryDto, UpdateBookCategoryDto } from './dto/create-book-category.dto';
import { CategoryQueryDto } from './dto/library-query.dto';
import { LibraryPermission } from './permissions';

@Controller('library/categories')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class LibraryCategoryController {
  constructor(private readonly libraryCategoryService: LibraryCategoryService) {}

  @Post()
  @RequirePermission(LibraryPermission.CREATE_CATEGORY)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.INVENTORY_CATEGORY,
    description: 'Created a new book category',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createCategoryDto: CreateBookCategoryDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    return this.libraryCategoryService.create(createCategoryDto, createdBy);
  }

  @Get()
  @RequirePermission(LibraryPermission.VIEW_CATEGORIES)
  async findAll(@Query() query: CategoryQueryDto, @Request() req) {
    const branchId = req.user?.branch?._id || req.user?.branch;
    return this.libraryCategoryService.findAll(query, branchId?.toString());
  }

  @Get('active')
  @RequirePermission(LibraryPermission.VIEW_CATEGORIES)
  async getActiveCategories(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.libraryCategoryService.getActiveCategories(effectiveBranchId?.toString());
  }

  @Get(':id')
  @RequirePermission(LibraryPermission.VIEW_CATEGORIES)
  async findOne(@Param('id') id: string) {
    const category = await this.libraryCategoryService.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  @Patch(':id')
  @RequirePermission(LibraryPermission.UPDATE_CATEGORY)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.INVENTORY_CATEGORY,
    description: 'Updated book category',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateBookCategoryDto,
  ) {
    return this.libraryCategoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @RequirePermission(LibraryPermission.DELETE_CATEGORY)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.INVENTORY_CATEGORY,
    description: 'Deleted book category',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.libraryCategoryService.remove(id);
    return { message: 'Category deleted successfully' };
  }
}

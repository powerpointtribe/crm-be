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
import { LibraryBookService } from './library-book.service';
import { CreateBookDto, UpdateBookDto } from './dto/create-book.dto';
import { BookQueryDto } from './dto/library-query.dto';
import { LibraryPermission } from './permissions';

@Controller('library/books')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class LibraryBookController {
  constructor(private readonly libraryBookService: LibraryBookService) {}

  @Post()
  @RequirePermission(LibraryPermission.CREATE_BOOK)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Added a new book to the library',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createBookDto: CreateBookDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    return this.libraryBookService.create(createBookDto, createdBy);
  }

  @Get()
  @RequirePermission(LibraryPermission.VIEW_BOOKS)
  async findAll(@Query() query: BookQueryDto, @Request() req) {
    const branchId = req.user?.branch?._id || req.user?.branch;
    return this.libraryBookService.findAll(query, branchId?.toString());
  }

  @Get('stats')
  @RequirePermission(LibraryPermission.VIEW_STATS)
  async getStats(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.libraryBookService.getBookStats(effectiveBranchId?.toString());
  }

  @Get(':id')
  @RequirePermission(LibraryPermission.VIEW_BOOKS)
  async findOne(@Param('id') id: string) {
    const book = await this.libraryBookService.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }
    return book;
  }

  @Get(':id/details')
  @RequirePermission(LibraryPermission.VIEW_BOOKS)
  async findOneWithBorrowings(@Param('id') id: string) {
    const book = await this.libraryBookService.findByIdWithBorrowings(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }
    return book;
  }

  @Patch(':id')
  @RequirePermission(LibraryPermission.UPDATE_BOOK)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Updated book information',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateBookDto: UpdateBookDto,
    @Request() req,
  ) {
    const updatedBy = req.user?._id?.toString();
    return this.libraryBookService.update(id, updateBookDto, updatedBy);
  }

  @Delete(':id')
  @RequirePermission(LibraryPermission.DELETE_BOOK)
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Removed book from library',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    await this.libraryBookService.remove(id);
    return { message: 'Book deleted successfully' };
  }
}

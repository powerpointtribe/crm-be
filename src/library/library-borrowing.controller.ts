import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { LibraryBorrowingService } from './library-borrowing.service';
import {
  CreateBorrowingDto,
  ReturnBookDto,
  UpdateBorrowingDto,
} from './dto/create-borrowing.dto';
import { BorrowingQueryDto } from './dto/library-query.dto';
import { LibraryPermission } from './permissions';

@Controller('library/borrowings')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
export class LibraryBorrowingController {
  constructor(private readonly libraryBorrowingService: LibraryBorrowingService) {}

  @Post()
  @RequirePermission(LibraryPermission.CREATE_BORROWING)
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Issued book to member',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createBorrowingDto: CreateBorrowingDto, @Request() req) {
    const issuedBy = req.user?._id?.toString();
    return this.libraryBorrowingService.create(createBorrowingDto, issuedBy);
  }

  @Get()
  @RequirePermission(LibraryPermission.VIEW_BORROWINGS)
  async findAll(@Query() query: BorrowingQueryDto, @Request() req) {
    const branchId = req.user?.branch?._id || req.user?.branch;
    return this.libraryBorrowingService.findAll(query, branchId?.toString());
  }

  @Get('overdue')
  @RequirePermission(LibraryPermission.VIEW_OVERDUE)
  async getOverdueBorrowings(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.libraryBorrowingService.getOverdueBorrowings(effectiveBranchId?.toString());
  }

  @Get('statistics')
  @RequirePermission(LibraryPermission.VIEW_STATS)
  async getStatistics(@Query('branchId') branchId: string, @Request() req) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.libraryBorrowingService.getStatistics(effectiveBranchId?.toString());
  }

  @Get('member/:memberId')
  @RequirePermission(LibraryPermission.VIEW_MEMBER_HISTORY)
  async getMemberHistory(
    @Param('memberId') memberId: string,
    @Query('branchId') branchId: string,
    @Request() req,
  ) {
    const effectiveBranchId = branchId || req.user?.branch?._id || req.user?.branch;
    return this.libraryBorrowingService.getMemberHistory(
      memberId,
      effectiveBranchId?.toString(),
    );
  }

  @Get(':id')
  @RequirePermission(LibraryPermission.VIEW_BORROWINGS)
  async findOne(@Param('id') id: string) {
    const borrowing = await this.libraryBorrowingService.findById(id);
    if (!borrowing) {
      throw new NotFoundException(`Borrowing record with ID ${id} not found`);
    }
    return borrowing;
  }

  @Patch(':id')
  @RequirePermission(LibraryPermission.CREATE_BORROWING)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Updated borrowing record',
    getEntityId: (result, request) => request.params.id,
  })
  async update(
    @Param('id') id: string,
    @Body() updateBorrowingDto: UpdateBorrowingDto,
  ) {
    return this.libraryBorrowingService.update(id, updateBorrowingDto);
  }

  @Patch(':id/return')
  @RequirePermission(LibraryPermission.RETURN_BOOK)
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: AuditEntity.INVENTORY_ITEM,
    description: 'Processed book return',
    getEntityId: (result, request) => request.params.id,
  })
  async returnBook(
    @Param('id') id: string,
    @Body() returnBookDto: ReturnBookDto,
    @Request() req,
  ) {
    const returnedBy = req.user?._id?.toString();
    return this.libraryBorrowingService.returnBook(id, returnBookDto, returnedBy);
  }
}

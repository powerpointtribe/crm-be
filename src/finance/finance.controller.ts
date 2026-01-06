import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission, RequireAnyPermission } from '../roles/decorators/require-permission.decorator';
import { FinanceService } from './finance.service';
import { ExpenseCategoryService } from './expense-category.service';
import { FormFieldConfigService } from './form-field-config.service';
import { FinancePermission } from './permissions';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { DisburseRequisitionDto } from './dto/disburse-requisition.dto';
import { RequisitionQueryDto } from './dto/requisition-query.dto';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-category.dto';
import {
  CreateFormFieldConfigDto,
  UpdateFormFieldConfigDto,
  BulkUpdateSortOrderDto,
} from './dto/form-field-config.dto';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly expenseCategoryService: ExpenseCategoryService,
    private readonly formFieldConfigService: FormFieldConfigService,
  ) {}

  /**
   * Helper to extract branch ID from user object
   * Branch can be populated as object { _id, name } or just an ObjectId
   */
  private getBranchId(user: any): string {
    if (!user?.branch) {
      console.log('getBranchId: No branch on user', { userId: user?._id });
      return '';
    }
    const branchId = typeof user.branch === 'object'
      ? user.branch?._id?.toString()
      : user.branch?.toString();
    console.log('getBranchId:', { branchType: typeof user.branch, branchId, rawBranch: user.branch });
    return branchId || '';
  }

  // ============== Requisition Endpoints ==============

  @Post('requisitions')
  @RequirePermission(FinancePermission.CREATE_REQUISITION)
  @ApiOperation({ summary: 'Create a new requisition' })
  @ApiResponse({ status: 201, description: 'Requisition created successfully' })
  async createRequisition(
    @Body() dto: CreateRequisitionDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.create(dto, req.user);
    return ResponseUtil.success(result, 'Requisition created successfully');
  }

  @Get('requisitions')
  @RequirePermission(FinancePermission.VIEW_REQUISITIONS)
  @ApiOperation({ summary: 'Get all requisitions' })
  async findAllRequisitions(
    @Query() query: RequisitionQueryDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.findAll(query, req.user);
    return ResponseUtil.success(result, 'Requisitions retrieved successfully');
  }

  @Get('requisitions/my')
  @RequirePermission(FinancePermission.CREATE_REQUISITION)
  @ApiOperation({ summary: 'Get current user requisitions' })
  async findMyRequisitions(
    @Query() query: RequisitionQueryDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.findMyRequisitions(query, req.user);
    return ResponseUtil.success(result, 'Requisitions retrieved successfully');
  }

  @Get('requisitions/pending-approval')
  @RequirePermission(FinancePermission.APPROVE_REQUISITION)
  @ApiOperation({ summary: 'Get requisitions pending approval' })
  async findPendingApproval(
    @Query() query: RequisitionQueryDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.findPendingApproval(query, req.user);
    return ResponseUtil.success(result, 'Pending approvals retrieved successfully');
  }

  @Get('requisitions/pending-disbursement')
  @RequirePermission(FinancePermission.DISBURSE)
  @ApiOperation({ summary: 'Get requisitions pending disbursement' })
  async findPendingDisbursement(
    @Query() query: RequisitionQueryDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.findPendingDisbursement(query, req.user);
    return ResponseUtil.success(result, 'Pending disbursements retrieved successfully');
  }

  @Get('requisitions/:id')
  @RequireAnyPermission(
    FinancePermission.VIEW_REQUISITIONS,
    FinancePermission.CREATE_REQUISITION,
  )
  @ApiOperation({ summary: 'Get a single requisition by ID' })
  async findOneRequisition(@Param('id') id: string) {
    const result = await this.financeService.findOne(id);
    return ResponseUtil.success(result, 'Requisition retrieved successfully');
  }

  @Patch('requisitions/:id')
  @RequirePermission(FinancePermission.CREATE_REQUISITION)
  @ApiOperation({ summary: 'Update a draft requisition' })
  async updateRequisition(
    @Param('id') id: string,
    @Body() dto: UpdateRequisitionDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.update(id, dto, req.user);
    return ResponseUtil.success(result, 'Requisition updated successfully');
  }

  @Post('requisitions/:id/submit')
  @RequirePermission(FinancePermission.CREATE_REQUISITION)
  @ApiOperation({ summary: 'Submit a draft requisition for approval' })
  async submitRequisition(@Param('id') id: string, @Req() req: any) {
    const result = await this.financeService.submit(id, req.user);
    return ResponseUtil.success(result, 'Requisition submitted successfully');
  }

  @Post('requisitions/:id/approve')
  @RequirePermission(FinancePermission.APPROVE_REQUISITION)
  @ApiOperation({ summary: 'Approve a requisition' })
  async approveRequisition(
    @Param('id') id: string,
    @Body() dto: ApproveRequisitionDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.approve(id, dto, req.user);
    return ResponseUtil.success(result, 'Requisition approved successfully');
  }

  @Post('requisitions/:id/reject')
  @RequirePermission(FinancePermission.APPROVE_REQUISITION)
  @ApiOperation({ summary: 'Reject a requisition' })
  async rejectRequisition(
    @Param('id') id: string,
    @Body() dto: RejectRequisitionDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.reject(id, dto, req.user);
    return ResponseUtil.success(result, 'Requisition rejected successfully');
  }

  @Post('requisitions/:id/disburse')
  @RequirePermission(FinancePermission.DISBURSE)
  @ApiOperation({ summary: 'Disburse funds for an approved requisition' })
  async disburseRequisition(
    @Param('id') id: string,
    @Body() dto: DisburseRequisitionDto,
    @Req() req: any,
  ) {
    const result = await this.financeService.disburse(id, dto, req.user);
    return ResponseUtil.success(result, 'Requisition disbursed successfully');
  }

  @Post('requisitions/:id/close')
  @RequirePermission(FinancePermission.DISBURSE)
  @ApiOperation({ summary: 'Close a disbursed requisition' })
  async closeRequisition(@Param('id') id: string, @Req() req: any) {
    const result = await this.financeService.close(id, req.user);
    return ResponseUtil.success(result, 'Requisition closed successfully');
  }

  @Delete('requisitions/:id')
  @RequirePermission(FinancePermission.DELETE_REQUISITION)
  @ApiOperation({ summary: 'Delete a draft requisition' })
  async deleteRequisition(@Param('id') id: string, @Req() req: any) {
    await this.financeService.remove(id, req.user);
    return ResponseUtil.success(null, 'Requisition deleted successfully');
  }

  // ============== Dashboard & Reports ==============

  @Get('dashboard/statistics')
  @RequireAnyPermission(
    FinancePermission.VIEW_FINANCE_DASHBOARD,
    FinancePermission.VIEW_REQUISITIONS,
  )
  @ApiOperation({ summary: 'Get finance dashboard statistics' })
  async getDashboardStatistics(@Req() req: any) {
    const branchId = req.user?.branch?.toString();
    const result = await this.financeService.getStatistics(branchId);
    return ResponseUtil.success(result, 'Statistics retrieved successfully');
  }

  // ============== Expense Category Endpoints ==============

  @Post('expense-categories')
  @RequirePermission(FinancePermission.MANAGE_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Create a new expense category' })
  async createExpenseCategory(
    @Body() dto: CreateExpenseCategoryDto,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const result = await this.expenseCategoryService.create(
      dto,
      branchId,
      req.user._id.toString(),
    );
    return ResponseUtil.success(result, 'Expense category created successfully');
  }

  @Get('expense-categories')
  @RequireAnyPermission(
    FinancePermission.VIEW_EXPENSE_CATEGORIES,
    FinancePermission.CREATE_REQUISITION,
  )
  @ApiOperation({ summary: 'Get all expense categories' })
  async findAllExpenseCategories(@Req() req: any) {
    const branchId = this.getBranchId(req.user);
    const result = await this.expenseCategoryService.findAll(branchId);
    return ResponseUtil.success(result, 'Expense categories retrieved successfully');
  }

  @Get('expense-categories/:id')
  @RequirePermission(FinancePermission.VIEW_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Get a single expense category' })
  async findOneExpenseCategory(@Param('id') id: string) {
    const result = await this.expenseCategoryService.findOne(id);
    return ResponseUtil.success(result, 'Expense category retrieved successfully');
  }

  @Patch('expense-categories/:id')
  @RequirePermission(FinancePermission.MANAGE_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Update an expense category' })
  async updateExpenseCategory(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @Req() req: any,
  ) {
    const result = await this.expenseCategoryService.update(
      id,
      dto,
      req.user._id.toString(),
    );
    return ResponseUtil.success(result, 'Expense category updated successfully');
  }

  @Delete('expense-categories/:id')
  @RequirePermission(FinancePermission.MANAGE_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Delete an expense category' })
  async deleteExpenseCategory(@Param('id') id: string) {
    await this.expenseCategoryService.remove(id);
    return ResponseUtil.success(null, 'Expense category deleted successfully');
  }

  @Post('expense-categories/initialize')
  @RequirePermission(FinancePermission.MANAGE_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Initialize default expense categories for the branch' })
  async initializeExpenseCategories(@Req() req: any) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();

    const result = await this.expenseCategoryService.initializeDefaults(
      branchId,
      memberId,
    );

    if (!result.created) {
      return ResponseUtil.success(
        result,
        `Expense categories already exist (${result.count} categories)`,
      );
    }

    return ResponseUtil.success(
      result,
      `Successfully created ${result.count} default expense categories`,
    );
  }

  @Post('expense-categories/reset')
  @RequirePermission(FinancePermission.MANAGE_EXPENSE_CATEGORIES)
  @ApiOperation({ summary: 'Reset and reinitialize expense categories (deletes all existing)' })
  async resetExpenseCategories(@Req() req: any) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();

    const result = await this.expenseCategoryService.resetAndInitialize(
      branchId,
      memberId,
    );

    return ResponseUtil.success(
      result,
      `Expense categories reset and reinitialized (${result.count} categories created)`,
    );
  }

  // ============== Form Field Configuration Endpoints ==============

  @Get('form-fields/:formType')
  @RequireAnyPermission(
    FinancePermission.VIEW_FORM_FIELDS,
    FinancePermission.CREATE_REQUISITION,
  )
  @ApiOperation({ summary: 'Get form field configurations for a form type' })
  async getFormFields(
    @Param('formType') formType: string,
    @Query('includeInactive') includeInactive: string,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const result = await this.formFieldConfigService.findByFormType(
      branchId,
      formType,
      includeInactive === 'true',
    );
    return ResponseUtil.success(result, 'Form fields retrieved successfully');
  }

  @Post('form-fields')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Create a new form field configuration' })
  async createFormField(
    @Body() dto: CreateFormFieldConfigDto,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();
    const result = await this.formFieldConfigService.create(
      branchId,
      memberId,
      dto,
    );
    return ResponseUtil.success(result, 'Form field created successfully');
  }

  @Patch('form-fields/:id')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Update a form field configuration' })
  async updateFormField(
    @Param('id') id: string,
    @Body() dto: UpdateFormFieldConfigDto,
    @Req() req: any,
  ) {
    const memberId = req.user._id.toString();
    const result = await this.formFieldConfigService.update(id, memberId, dto);
    return ResponseUtil.success(result, 'Form field updated successfully');
  }

  @Delete('form-fields/:id')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Delete a form field configuration' })
  async deleteFormField(@Param('id') id: string) {
    await this.formFieldConfigService.delete(id);
    return ResponseUtil.success(null, 'Form field deleted successfully');
  }

  @Post('form-fields/:id/toggle-active')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Toggle form field active status' })
  async toggleFormFieldActive(@Param('id') id: string, @Req() req: any) {
    const memberId = req.user._id.toString();
    const result = await this.formFieldConfigService.toggleActive(id, memberId);
    return ResponseUtil.success(result, 'Form field status toggled successfully');
  }

  @Post('form-fields/bulk-sort')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Bulk update sort order for form fields' })
  async bulkUpdateSortOrder(
    @Body() dto: BulkUpdateSortOrderDto,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();
    await this.formFieldConfigService.bulkUpdateSortOrder(
      branchId,
      memberId,
      dto,
    );
    return ResponseUtil.success(null, 'Sort order updated successfully');
  }

  @Post('form-fields/initialize/:formType')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Initialize default form fields for a form type' })
  async initializeFormFields(
    @Param('formType') formType: string,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();

    if (formType === 'requisition') {
      const result = await this.formFieldConfigService.initializeDefaultFields(
        branchId,
        memberId,
      );

      if (!result.created) {
        return ResponseUtil.success(
          result,
          `Form fields already initialized (${result.count} fields exist)`,
        );
      }

      return ResponseUtil.success(
        result,
        `Successfully created ${result.count} default form fields`,
      );
    }

    return ResponseUtil.success(null, 'Unknown form type');
  }

  @Post('form-fields/reset/:formType')
  @RequirePermission(FinancePermission.MANAGE_FORM_FIELDS)
  @ApiOperation({ summary: 'Reset and reinitialize form fields (deletes all existing fields)' })
  async resetFormFields(
    @Param('formType') formType: string,
    @Req() req: any,
  ) {
    const branchId = this.getBranchId(req.user);
    const memberId = req.user._id.toString();

    if (formType === 'requisition') {
      const result = await this.formFieldConfigService.resetAndInitialize(
        branchId,
        memberId,
        formType,
      );

      return ResponseUtil.success(
        result,
        `Form fields reset and reinitialized (${result.count} fields created)`,
      );
    }

    return ResponseUtil.success(null, 'Unknown form type');
  }
}

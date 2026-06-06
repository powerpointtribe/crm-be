import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { FinanceService } from './finance.service';
import { ExpenseCategoryService } from './expense-category.service';
import { ActionTokenService } from './action-token.service';
import {
  PublicCreateRequisitionDto,
  PublicApproveDto,
  PublicRejectDto,
  PublicDisburseDto,
  TokenVerificationResponseDto,
  CheckLxlEligibilityDto,
  LxlEligibilityResponseDto,
} from './dto/public-requisition.dto';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Public Finance')
@Controller('public/finance')
export class PublicFinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly expenseCategoryService: ExpenseCategoryService,
    private readonly actionTokenService: ActionTokenService,
  ) {}

  /**
   * Check if a member is eligible to raise requisitions (LXL status)
   */
  @Public()
  @Post('check-eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if member is eligible to raise requisitions (LXL status)' })
  @ApiResponse({ status: 200, description: 'Eligibility check result', type: LxlEligibilityResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async checkLxlEligibility(@Body() dto: CheckLxlEligibilityDto) {
    const result = await this.financeService.checkLxlEligibility(dto.email, dto.branchSlug);
    return ResponseUtil.success(result, 'Eligibility check completed');
  }

  /**
   * Create a public requisition (no authentication required)
   */
  @Public()
  @Post('requisitions')
  @ApiOperation({ summary: 'Create a public requisition (no auth required)' })
  @ApiResponse({ status: 201, description: 'Requisition created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createPublicRequisition(@Body() dto: PublicCreateRequisitionDto) {
    const result = await this.financeService.createPublicRequisition(dto);
    return ResponseUtil.success(result, 'Requisition submitted successfully');
  }

  /**
   * Verify an action token and get requisition details
   */
  @Public()
  @Get('requisitions/verify-token/:token')
  @ApiOperation({ summary: 'Verify action token and get requisition details' })
  @ApiParam({ name: 'token', description: 'The 64-character action token' })
  @ApiResponse({ status: 200, description: 'Token verification result' })
  async verifyToken(@Param('token') token: string) {
    const validation = await this.actionTokenService.validateToken(token);

    if (!validation.valid) {
      return ResponseUtil.success(
        {
          valid: false,
          error: validation.error,
        } as TokenVerificationResponseDto,
        'Token verification failed',
      );
    }

    // Get token with populated requisition
    const tokenWithRequisition = await this.actionTokenService.getTokenWithRequisition(token);

    return ResponseUtil.success(
      {
        valid: true,
        actionType: validation.actionToken!.actionType,
        requisition: tokenWithRequisition?.requisitionId,
        expiresAt: validation.actionToken!.expiresAt,
        recipientEmail: validation.actionToken!.recipientEmail,
      } as TokenVerificationResponseDto,
      'Token verified successfully',
    );
  }

  /**
   * Approve a requisition using token
   */
  @Public()
  @Post('requisitions/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve requisition with token (no auth required)' })
  @ApiResponse({ status: 200, description: 'Requisition approved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token or requisition state' })
  async approveWithToken(@Body() dto: PublicApproveDto) {
    const result = await this.financeService.approveWithToken(dto.token, dto.notes);
    return ResponseUtil.success(result, 'Requisition approved successfully');
  }

  /**
   * Reject a requisition using token
   */
  @Public()
  @Post('requisitions/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject requisition with token (no auth required)' })
  @ApiResponse({ status: 200, description: 'Requisition rejected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token or requisition state' })
  async rejectWithToken(@Body() dto: PublicRejectDto) {
    const result = await this.financeService.rejectWithToken(dto.token, dto.reason);
    return ResponseUtil.success(result, 'Requisition rejected successfully');
  }

  /**
   * Disburse a requisition using token
   */
  @Public()
  @Post('requisitions/disburse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disburse requisition with token (no auth required)' })
  @ApiResponse({ status: 200, description: 'Requisition disbursed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token or requisition state' })
  async disburseWithToken(@Body() dto: PublicDisburseDto) {
    const result = await this.financeService.disburseWithToken(
      dto.token,
      dto.notes,
    );
    return ResponseUtil.success(result, 'Requisition disbursed successfully');
  }

  /**
   * Get expense categories for a branch (public)
   */
  @Public()
  @Get('expense-categories/:branchSlug')
  @ApiOperation({ summary: 'Get expense categories for a branch (no auth required)' })
  @ApiParam({ name: 'branchSlug', description: 'Campus slug (e.g., lagos-mainland)' })
  @ApiResponse({ status: 200, description: 'Expense categories retrieved' })
  async getPublicExpenseCategories(@Param('branchSlug') branchSlug: string) {
    const categories = await this.expenseCategoryService.findByBranchSlug(branchSlug);
    return ResponseUtil.success(categories, 'Expense categories retrieved successfully');
  }

  /**
   * Get all branches (public)
   */
  @Public()
  @Get('branches')
  @ApiOperation({ summary: 'Get all branches for public requisition form' })
  @ApiResponse({ status: 200, description: 'Campuses retrieved' })
  async getPublicBranches() {
    const branches = await this.financeService.getPublicBranches();
    return ResponseUtil.success(branches, 'Campuses retrieved successfully');
  }

  /**
   * Get a single branch by slug (public)
   */
  @Public()
  @Get('branches/:slug')
  @ApiOperation({ summary: 'Get branch info by slug (no auth required)' })
  @ApiParam({ name: 'slug', description: 'Campus slug (e.g., lagos-mainland)' })
  @ApiResponse({ status: 200, description: 'Campus retrieved' })
  @ApiResponse({ status: 404, description: 'Campus not found' })
  async getPublicBranchBySlug(@Param('slug') slug: string) {
    const branch = await this.financeService.getPublicBranchBySlug(slug);
    return ResponseUtil.success(branch, 'Campus retrieved successfully');
  }

  /**
   * Get groups/units for a branch (public)
   */
  @Public()
  @Get('groups/:branchSlug')
  @ApiOperation({ summary: 'Get groups/units for a branch (no auth required)' })
  @ApiParam({ name: 'branchSlug', description: 'Campus slug' })
  @ApiResponse({ status: 200, description: 'Groups retrieved' })
  async getPublicGroups(@Param('branchSlug') branchSlug: string) {
    const groups = await this.financeService.getPublicGroups(branchSlug);
    return ResponseUtil.success(groups, 'Groups retrieved successfully');
  }
}

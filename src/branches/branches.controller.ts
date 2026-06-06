import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Branch } from './schemas/branch.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermission('branches:create')
  @ApiOperation({ summary: 'Create a new campus' })
  @ApiResponse({ status: 201, description: 'Campus created successfully' })
  async create(@Body() createBranchDto: CreateBranchDto) {
    const branch = await this.branchesService.create(createBranchDto);
    return ResponseUtil.success(branch, 'Campus created successfully');
  }

  @Get()
  @RequirePermission('branches:view')
  @ApiOperation({ summary: 'Get all campuses' })
  @ApiResponse({ status: 200, description: 'Campuses retrieved successfully' })
  async findAll() {
    const branches = await this.branchesService.findAll();
    return ResponseUtil.success(branches, 'Campuses retrieved successfully');
  }

  @Get('selector')
  @RequirePermission('branches:view-all')
  @ApiOperation({ summary: 'Get campuses for campus selector dropdown' })
  @ApiResponse({ status: 200, description: 'Campuses retrieved for selector' })
  async getBranchesForSelector() {
    const branches = await this.branchesService.findAll();
    // Return only essential fields for the selector
    const selectorBranches = branches.map((b) => ({
      _id: b._id,
      name: b.name,
      slug: b.slug,
      isActive: b.isActive,
    }));
    return ResponseUtil.success(selectorBranches, 'Campuses retrieved successfully');
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get all active campuses (public)' })
  @ApiResponse({ status: 200, description: 'Campuses retrieved successfully' })
  async findAllPublic() {
    const branches = await this.branchesService.findAll();
    // Return only public-facing branch data
    const publicBranches = branches.map((b) => ({
      name: b.name,
      slug: b.slug,
      address: b.address,
      phone: b.phone,
      email: b.email,
    }));
    return ResponseUtil.success(publicBranches, 'Campuses retrieved successfully');
  }

  @Get(':id')
  @RequirePermission('branches:view-details')
  @ApiOperation({ summary: 'Get campus by ID' })
  @ApiParam({ name: 'id', description: 'Campus ID' })
  @ApiResponse({ status: 200, description: 'Campus retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Campus not found' })
  async findOne(@Param('id') id: string) {
    const branch = await this.branchesService.findById(id);
    if (!branch) {
      return ResponseUtil.error('Campus not found');
    }
    return ResponseUtil.success(branch, 'Campus retrieved successfully');
  }

  @Patch(':id')
  @RequirePermission('branches:update')
  @ApiOperation({ summary: 'Update campus' })
  @ApiParam({ name: 'id', description: 'Campus ID' })
  @ApiResponse({ status: 200, description: 'Campus updated successfully' })
  async update(@Param('id') id: string, @Body() updateData: Partial<Branch>) {
    const branch = await this.branchesService.update(id, updateData);
    if (!branch) {
      return ResponseUtil.error('Campus not found');
    }
    return ResponseUtil.success(branch, 'Campus updated successfully');
  }

  // NOTE: Pastor assignment endpoints have been removed.
  // Use the /role-assignments endpoint to assign roles with branch scope.
  // Example: POST /role-assignments with scopeType='branch' and scopeId=branchId

  @Delete(':id')
  @RequirePermission('branches:delete')
  @ApiOperation({ summary: 'Deactivate campus' })
  @ApiParam({ name: 'id', description: 'Campus ID' })
  @ApiResponse({ status: 200, description: 'Campus deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    const branch = await this.branchesService.deactivate(id);
    if (!branch) {
      return ResponseUtil.error('Campus not found');
    }
    return ResponseUtil.success(branch, 'Campus deactivated successfully');
  }
}

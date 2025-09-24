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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchDto } from '../common/dto/search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-roles.enums';
import { ResponseUtil } from '../common/utils/response.util';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return ResponseUtil.success(user, 'User created successfully');
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Get all users with pagination and search' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(@Query() searchDto: SearchDto) {
    const users = await this.usersService.findAll(searchDto);
    return ResponseUtil.success(users, 'Users retrieved successfully');
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: 200,
    description: 'User stats retrieved successfully',
  })
  async getUserStats() {
    const stats = await this.usersService.getUserStats();
    return ResponseUtil.success(stats, 'User stats retrieved successfully');
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.usersService.findById(user._id);
    return ResponseUtil.success(profile, 'Profile retrieved successfully');
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return ResponseUtil.success(user, 'User retrieved successfully');
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return ResponseUtil.success(user, 'User updated successfully');
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivate(@Param('id') id: string) {
    const user = await this.usersService.deactivate(id);
    return ResponseUtil.success(user, 'User deactivated successfully');
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.LEADERSHIP)
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activate(@Param('id') id: string) {
    const user = await this.usersService.activate(id);
    return ResponseUtil.success(user, 'User activated successfully');
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return ResponseUtil.success(null, 'User deleted successfully');
  }
}

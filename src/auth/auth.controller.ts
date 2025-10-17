import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { CreateMemberDto } from '../members/dto/create-member.dto';

@ApiTags('Authentication (Unified)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return ResponseUtil.success(result, 'Login successful');
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new member account' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() registerDto: CreateMemberDto) {
    const result = await this.authService.register(registerDto);
    return ResponseUtil.success(result, 'Registration successful');
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current member profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.authService.getProfile(user.sub);
    return ResponseUtil.success(profile, 'Profile retrieved successfully');
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('permissions')
  @ApiOperation({ summary: 'Get current member permissions summary' })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  async getPermissions(@CurrentUser() user: any) {
    const permissions = await this.authService.getPermissionsSummary(user.sub);
    return ResponseUtil.success(
      permissions,
      'Permissions retrieved successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('accessible-modules')
  @ApiOperation({ summary: 'Get modules accessible to current member' })
  @ApiResponse({
    status: 200,
    description: 'Accessible modules retrieved successfully',
  })
  async getAccessibleModules(@CurrentUser() user: any) {
    const profile = await this.authService.getProfile(user.sub);
    return ResponseUtil.success(
      { modules: profile.accessibleModules },
      'Accessible modules retrieved successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout (client should also remove token)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout() {
    // For JWT, logout is typically handled client-side by removing the token
    // But we can log the logout event here if needed
    return ResponseUtil.success(null, 'Logout successful');
  }
}

import { Controller, Post, Body, UseGuards, Get, Query, ForbiddenException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ResponseUtil } from '../common/utils/response.util';
import { CreateMemberDto } from '../members/dto/create-member.dto';

@ApiTags('Authentication')
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
    return ResponseUtil.success(result, 'Login was successfully done');
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registration disabled - invitation required' })
  @ApiResponse({ status: 403, description: 'Registration is disabled' })
  async register() {
    throw new ForbiddenException(
      'Public registration is disabled. Please contact an administrator for an invitation.'
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current member profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser() user: any) {
    // JwtStrategy.validate() returns the member document, so the id lives on
    // `_id` (not `sub`, which only exists on the raw JWT payload).
    const memberId = user._id?.toString() ?? user.sub;
    const profile = await this.authService.getProfile(memberId);
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
    const memberId = user._id?.toString() ?? user.sub;
    const permissions = await this.authService.getPermissionsSummary(memberId);
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
    const memberId = user._id?.toString() ?? user.sub;
    const profile = await this.authService.getProfile(memberId);
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

  // PASSWORD RESET ENDPOINTS
  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Password reset link sent if email exists',
  })
  @ApiResponse({ status: 400, description: 'Invalid email format' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(forgotPasswordDto);
    return ResponseUtil.success(result, result.message);
  }

  @Public()
  @Get('verify-reset-token')
  @ApiOperation({ summary: 'Verify password reset token validity' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyResetToken(@Query('token') token: string) {
    const result = await this.authService.verifyResetToken(token);
    return ResponseUtil.success(result, 'Token is valid');
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify password reset OTP (deprecated)' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto);
    return ResponseUtil.success(result, result.message);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token from email link' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token or request' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(resetPasswordDto);
    return ResponseUtil.success(result, result.message);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change password for authenticated member' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(
      user._id.toString(),
      changePasswordDto,
    );
    return ResponseUtil.success(result, result.message);
  }
}

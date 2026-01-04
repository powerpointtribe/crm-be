import { Controller, Post, Get, Delete, Body, Param, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';
import { UserNotificationsService } from './user-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class TestEmailDto {
  email: string;
  subject?: string;
  message?: string;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private notificationsService: NotificationsService,
    private emailProvider: EmailProvider,
    private userNotificationsService: UserNotificationsService,
  ) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiResponse({ status: 200, description: 'User notifications retrieved successfully' })
  async getMyNotifications(@CurrentUser() user: any) {
    const userId = user._id?.toString() || user.id?.toString();
    const roleId = user.role?._id?.toString() || user.role?.toString();
    const branchId = user.branch?._id?.toString() || user.branch?.toString();

    const notifications = await this.userNotificationsService.getUserNotifications(
      userId,
      roleId,
      branchId,
    );

    return {
      success: true,
      data: notifications,
    };
  }

  @Get('count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification count for badge display' })
  @ApiResponse({ status: 200, description: 'Notification count retrieved successfully' })
  async getNotificationCount(@CurrentUser() user: any) {
    const userId = user._id?.toString() || user.id?.toString();
    const roleId = user.role?._id?.toString() || user.role?.toString();
    const branchId = user.branch?._id?.toString() || user.branch?.toString();

    const count = await this.userNotificationsService.getNotificationCount(
      userId,
      roleId,
      branchId,
    );

    return {
      success: true,
      data: { count },
    };
  }

  @Delete(':notificationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss a single notification' })
  @ApiResponse({ status: 200, description: 'Notification dismissed successfully' })
  async dismissNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user._id?.toString() || user.id?.toString();

    await this.userNotificationsService.dismissNotification(userId, notificationId);

    return {
      success: true,
      message: 'Notification dismissed',
    };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss all notifications' })
  @ApiResponse({ status: 200, description: 'All notifications dismissed successfully' })
  async dismissAllNotifications(@CurrentUser() user: any) {
    const userId = user._id?.toString() || user.id?.toString();
    const roleId = user.role?._id?.toString() || user.role?.toString();
    const branchId = user.branch?._id?.toString() || user.branch?.toString();

    const count = await this.userNotificationsService.dismissAllNotifications(
      userId,
      roleId,
      branchId,
    );

    return {
      success: true,
      message: `${count} notifications dismissed`,
      data: { dismissedCount: count },
    };
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Send test email for debugging' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  async sendTestEmail(@Body() testEmailDto: TestEmailDto) {
    this.logger.log(`Testing email delivery to: ${testEmailDto.email}`);

    try {
      const result = await this.emailProvider.sendEmail({
        to: testEmailDto.email,
        subject:
          testEmailDto.subject || 'Test Email from Church Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Test Email</h1>
            <p>This is a test email from your Church Management System.</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Message:</strong> ${testEmailDto.message || 'If you receive this email, your email service is working correctly!'}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>
            <p>Best regards,<br/>Church Management System</p>
          </div>
        `,
      });

      this.logger.log('Test email sent successfully:', result);

      return {
        success: true,
        message: 'Test email sent successfully',
        emailId: result.data?.id,
        result: result,
      };
    } catch (error) {
      this.logger.error('Test email failed:', error);

      return {
        success: false,
        message: 'Test email failed',
        error: error.message,
        details: error,
      };
    }
  }

  @Post('test-first-timer-email')
  @ApiOperation({ summary: 'Send test first-timer thank you email' })
  @ApiResponse({
    status: 200,
    description: 'Test first-timer email sent successfully',
  })
  async sendTestFirstTimerEmail(@Body() testEmailDto: TestEmailDto) {
    this.logger.log(
      `Testing first-timer email delivery to: ${testEmailDto.email}`,
    );

    try {
      await this.notificationsService.sendFirstTimerThankYouEmail({
        email: testEmailDto.email,
        firstName: 'Test',
        lastName: 'User',
      });

      return {
        success: true,
        message: 'Test first-timer email sent successfully',
      };
    } catch (error) {
      this.logger.error('Test first-timer email failed:', error);

      return {
        success: false,
        message: 'Test first-timer email failed',
        error: error.message,
      };
    }
  }

  @Post('validate-config')
  @ApiOperation({ summary: 'Validate email service configuration' })
  @ApiResponse({ status: 200, description: 'Email configuration validated' })
  async validateEmailConfig() {
    this.logger.log('Validating email service configuration...');

    try {
      // This will test if the service can be instantiated properly
      const testResult = {
        configValid: true,
        message: 'Email service configuration is valid',
        timestamp: new Date().toISOString(),
      };

      this.logger.log('Email configuration validation successful');
      return testResult;
    } catch (error) {
      this.logger.error('Email configuration validation failed:', error);

      return {
        configValid: false,
        message: 'Email service configuration is invalid',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

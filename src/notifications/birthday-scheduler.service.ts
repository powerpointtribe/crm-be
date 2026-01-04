import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MembersService } from '../members/members.service';
import { NotificationsService } from './notifications.service';
import { UserPermissionsService } from '../roles/services/user-permissions.service';
import { NotificationsPermission } from './permissions';

@Injectable()
export class BirthdaySchedulerService {
  private readonly logger = new Logger(BirthdaySchedulerService.name);

  constructor(
    private readonly membersService: MembersService,
    private readonly notificationsService: NotificationsService,
    private readonly userPermissionsService: UserPermissionsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send birthday wishes to members at 8 AM daily
   */
  @Cron('0 8 * * *') // 8 AM daily
  async sendBirthdayWishes(): Promise<{
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting daily birthday wishes job...');

    const result = { sent: 0, failed: 0 };

    try {
      const birthdayMembers = await this.membersService.getBirthdaysToday();

      if (birthdayMembers.length === 0) {
        this.logger.log('No birthdays today');
        return result;
      }

      this.logger.log(`Found ${birthdayMembers.length} members with birthdays today`);

      for (const member of birthdayMembers) {
        if (!member.email) {
          this.logger.warn(
            `Skipping birthday wish for ${member.firstName} ${member.lastName} - no email`,
          );
          continue;
        }

        try {
          await this.notificationsService.sendBirthdayWishes({
            email: member.email,
            firstName: member.firstName,
            lastName: member.lastName,
          });

          this.logger.log(
            `Sent birthday wish to ${member.firstName} ${member.lastName}`,
          );
          result.sent++;
        } catch (error) {
          this.logger.error(
            `Failed to send birthday wish to ${member.email}: ${error.message}`,
          );
          result.failed++;
        }
      }

      this.logger.log(
        `Birthday wishes job completed: ${result.sent} sent, ${result.failed} failed`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Birthday wishes job failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send pre-birthday notifications to team members (3 days before)
   * Runs at 9 AM daily
   */
  @Cron('0 9 * * *') // 9 AM daily
  async sendPreBirthdayNotifications(): Promise<{
    notificationsSent: number;
    recipientsNotified: number;
    failed: number;
  }> {
    this.logger.log('Starting pre-birthday notifications job (3 days ahead)...');

    const result = { notificationsSent: 0, recipientsNotified: 0, failed: 0 };

    try {
      // Get members with birthdays in 3 days
      const upcomingBirthdayMembers = await this.membersService.getBirthdaysInDays(3);

      if (upcomingBirthdayMembers.length === 0) {
        this.logger.log('No birthdays in 3 days');
        return result;
      }

      this.logger.log(
        `Found ${upcomingBirthdayMembers.length} members with birthdays in 3 days`,
      );

      // Get users with pre-birthday notification permission
      const usersWithPermission = await this.userPermissionsService.getMembersWithPermission(
        NotificationsPermission.RECEIVE_PRE_BIRTHDAY_NOTIFICATION,
      );

      if (usersWithPermission.length === 0) {
        this.logger.log('No users with pre-birthday notification permission');
        return result;
      }

      this.logger.log(
        `Found ${usersWithPermission.length} users to notify about upcoming birthdays`,
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.example.com';

      // Send notification to each user with permission
      for (const recipient of usersWithPermission) {
        if (!recipient.email) {
          continue;
        }

        try {
          await this.notificationsService.sendPreBirthdayNotification({
            recipientEmail: recipient.email,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            upcomingBirthdays: upcomingBirthdayMembers.map((m) => ({
              firstName: m.firstName,
              lastName: m.lastName,
              dateOfBirth: m.dateOfBirth,
              email: m.email,
              phone: m.phone,
              branch: typeof m.branch === 'object' && m.branch !== null ? (m.branch as any).name : undefined,
            })),
            frontendUrl,
          });

          result.recipientsNotified++;
          result.notificationsSent += upcomingBirthdayMembers.length;
          this.logger.log(
            `Sent pre-birthday notification to ${recipient.email}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send pre-birthday notification to ${recipient.email}: ${error.message}`,
          );
          result.failed++;
        }
      }

      this.logger.log(
        `Pre-birthday notifications job completed: ${result.recipientsNotified} recipients notified, ${result.failed} failed`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Pre-birthday notifications job failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send birthday notification to users with permission (on the day)
   * Notifies leadership about today's birthdays
   * Runs at 7 AM daily (before birthday wishes are sent)
   */
  @Cron('0 7 * * *') // 7 AM daily
  async sendBirthdayDayNotifications(): Promise<{
    notificationsSent: number;
    recipientsNotified: number;
    failed: number;
  }> {
    this.logger.log('Starting birthday day notifications job...');

    const result = { notificationsSent: 0, recipientsNotified: 0, failed: 0 };

    try {
      // Get members with birthdays today
      const birthdayMembers = await this.membersService.getBirthdaysToday();

      if (birthdayMembers.length === 0) {
        this.logger.log('No birthdays today');
        return result;
      }

      this.logger.log(`Found ${birthdayMembers.length} members with birthdays today`);

      // Get users with birthday notification permission
      const usersWithPermission = await this.userPermissionsService.getMembersWithPermission(
        NotificationsPermission.RECEIVE_BIRTHDAY_NOTIFICATION,
      );

      if (usersWithPermission.length === 0) {
        this.logger.log('No users with birthday notification permission');
        return result;
      }

      this.logger.log(
        `Found ${usersWithPermission.length} users to notify about today's birthdays`,
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.example.com';

      // Send notification to each user with permission
      for (const recipient of usersWithPermission) {
        if (!recipient.email) {
          continue;
        }

        try {
          await this.notificationsService.sendBirthdayDayNotification({
            recipientEmail: recipient.email,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            todaysBirthdays: birthdayMembers.map((m) => ({
              firstName: m.firstName,
              lastName: m.lastName,
              dateOfBirth: m.dateOfBirth,
              email: m.email,
              phone: m.phone,
              branch: typeof m.branch === 'object' && m.branch !== null ? (m.branch as any).name : undefined,
            })),
            frontendUrl,
          });

          result.recipientsNotified++;
          result.notificationsSent += birthdayMembers.length;
          this.logger.log(
            `Sent birthday day notification to ${recipient.email}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send birthday day notification to ${recipient.email}: ${error.message}`,
          );
          result.failed++;
        }
      }

      this.logger.log(
        `Birthday day notifications job completed: ${result.recipientsNotified} recipients notified, ${result.failed} failed`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Birthday day notifications job failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manually trigger birthday wishes (for testing)
   */
  async triggerBirthdayWishes() {
    this.logger.log('Manually triggering birthday wishes...');
    return this.sendBirthdayWishes();
  }

  /**
   * Manually trigger pre-birthday notifications (for testing)
   */
  async triggerPreBirthdayNotifications() {
    this.logger.log('Manually triggering pre-birthday notifications...');
    return this.sendPreBirthdayNotifications();
  }

  /**
   * Manually trigger birthday day notifications (for testing)
   */
  async triggerBirthdayDayNotifications() {
    this.logger.log('Manually triggering birthday day notifications...');
    return this.sendBirthdayDayNotifications();
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './providers/email.provider';

@Injectable()
export class NotificationsService {
  private readonly frontendUrl: string;

  constructor(
    private emailProvider: EmailProvider,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }

  async sendWelcomeEmail(memberData: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Welcome to Our Church Family!</h1>
        <p>Dear ${memberData.firstName} ${memberData.lastName},</p>
        <p>We are thrilled to welcome you to our church family! Your visit means the world to us, and we're excited about the journey ahead.</p>
        <p>Our follow-up team will be in touch with you soon to help you get connected and answer any questions you might have.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>What's Next?</h3>
          <ul>
            <li>A member of our follow-up team will contact you within 24-48 hours</li>
            <li>You'll be invited to join a district (home cell) in your area</li>
            <li>Information about our upcoming new members class</li>
          </ul>
        </div>
        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: memberData.email,
      subject: 'Welcome to Our Church Family!',
      html,
    });
  }

  async sendFirstTimerFollowUp(firstTimerData: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Thank You for Visiting Us!</h1>
        <p>Dear ${firstTimerData.firstName} ${firstTimerData.lastName},</p>
        <p>Thank you for visiting our church! We hope you felt welcomed and blessed during your time with us.</p>
        <p>We would love to connect with you further and answer any questions you might have about our church community.</p>
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>We'd Love to Stay Connected</h3>
          <p>Our follow-up team will be reaching out to you in the coming days. In the meantime, feel free to:</p>
          <ul>
            <li>Reply to this email with any questions</li>
            <li>Visit our website for more information</li>
            <li>Join us again next Sunday!</li>
          </ul>
        </div>
        <p>We're excited about the possibility of you joining our church family!</p>
        <p>Blessings,<br/>The Follow-Up Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: firstTimerData.email,
      subject: 'Thank You for Visiting!',
      html,
    });
  }

  async sendFollowUpReminder(userData: {
    email: string;
    firstName: string;
    assignedFirstTimers: Array<{
      name: string;
      phone: string;
      daysSinceVisit: number;
    }>;
  }): Promise<void> {
    const firstTimersList = userData.assignedFirstTimers
      .map(
        (ft) =>
          `<li>${ft.name} (${ft.phone}) - ${ft.daysSinceVisit} days since visit</li>`,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e74c3c;">Follow-Up Reminder</h1>
        <p>Dear ${userData.firstName},</p>
        <p>This is a reminder that you have first-timers assigned to you who need follow-up:</p>
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>First-Timers Needing Follow-Up:</h3>
          <ul>${firstTimersList}</ul>
        </div>
        <p>Please reach out to them as soon as possible. Remember, timely follow-up is crucial for visitor retention!</p>
        <p>Blessings,<br/>The Church Management System</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: userData.email,
      subject: 'Follow-Up Reminder - First-Timers Assigned to You',
      html,
    });
  }

  async sendDistrictMeetingReminder(data: {
    recipients: Array<{ email: string; firstName: string }>;
    districtName: string;
    meetingDate: Date;
    location: string;
    hostName?: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">District Meeting Reminder</h1>
        <p>Dear {{name}},</p>
        <p>This is a reminder about our upcoming district meeting:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>${data.districtName} Meeting</h3>
          <p><strong>Date & Time:</strong> ${data.meetingDate.toLocaleDateString()} at ${data.meetingDate.toLocaleTimeString()}</p>
          <p><strong>Location:</strong> ${data.location}</p>
          ${data.hostName ? `<p><strong>Host:</strong> ${data.hostName}</p>` : ''}
        </div>
        <p>We're looking forward to fellowship, prayer, and growth together!</p>
        <p>See you there!</p>
        <p>Blessings,<br/>Your District Leadership</p>
      </div>
    `;

    await this.emailProvider.sendBulkEmail({
      recipients: data.recipients.map((r) => ({
        email: r.email,
        name: r.firstName,
      })),
      subject: `${data.districtName} Meeting Reminder`,
      html,
    });
  }

  async sendBirthdayWishes(memberData: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px;">
        <h1 style="text-align: center; font-size: 2.5em;">🎉 Happy Birthday! 🎉</h1>
        <div style="text-align: center; margin: 30px 0;">
          <h2 style="font-size: 1.8em; margin: 0;">Dear ${memberData.firstName},</h2>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 25px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 1.1em; line-height: 1.6;">On this special day, we want you to know how blessed we are to have you as part of our church family!</p>
          <p style="font-size: 1.1em; line-height: 1.6;">May God's grace and blessings be upon you today and always. We pray that this new year of your life will be filled with joy, peace, and abundant blessings.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <h3 style="font-size: 1.4em;">🎂 May your day be filled with joy! 🎂</h3>
        </div>
        <p style="text-align: center; font-size: 1.1em;">With love and prayers,<br/><strong>Your Church Family</strong></p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: memberData.email,
      subject: '🎉 Happy Birthday from Your Church Family!',
      html,
    });
  }

  /**
   * Send pre-birthday notification to team members (3 days before)
   */
  async sendPreBirthdayNotification(data: {
    recipientEmail: string;
    recipientName: string;
    upcomingBirthdays: Array<{
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      email?: string;
      phone?: string;
      branch?: string;
    }>;
    frontendUrl: string;
  }): Promise<void> {
    const birthdayDate = new Date(data.upcomingBirthdays[0]?.dateOfBirth);
    const formattedDate = birthdayDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const birthdayListHtml = data.upcomingBirthdays
      .map(
        (member) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${member.firstName} ${member.lastName}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.phone || '-'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.email || '-'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.branch || '-'}
          </td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upcoming Birthdays</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎂 Upcoming Birthdays Alert</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Birthdays in 3 days - ${formattedDate}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin-top: 0;">Hi ${data.recipientName},</p>

          <p>The following ${data.upcomingBirthdays.length === 1 ? 'member has a' : 'members have'} birthday coming up in <strong>3 days</strong>:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Campus</th>
              </tr>
            </thead>
            <tbody>
              ${birthdayListHtml}
            </tbody>
          </table>

          <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Reminder:</strong> Consider reaching out to wish them a happy birthday or organizing a celebration!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl}/members?tab=birthdays" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">View All Birthdays</a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Sent from Church Management System</p>
        </div>
      </body>
      </html>
    `;

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject: `🎂 Upcoming Birthdays: ${data.upcomingBirthdays.length} member${data.upcomingBirthdays.length > 1 ? 's' : ''} in 3 days`,
      html,
    });
  }

  /**
   * Send birthday day notification to team members (on the day)
   */
  async sendBirthdayDayNotification(data: {
    recipientEmail: string;
    recipientName: string;
    todaysBirthdays: Array<{
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
      email?: string;
      phone?: string;
      branch?: string;
    }>;
    frontendUrl: string;
  }): Promise<void> {
    const birthdayListHtml = data.todaysBirthdays
      .map(
        (member) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${member.firstName} ${member.lastName}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.phone || '-'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.email || '-'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${member.branch || '-'}
          </td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Today's Birthdays</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Today's Birthdays! 🎉</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin-top: 0;">Hi ${data.recipientName},</p>

          <p>The following ${data.todaysBirthdays.length === 1 ? 'member is' : 'members are'} celebrating ${data.todaysBirthdays.length === 1 ? 'their' : 'their'} birthday <strong>today</strong>:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Campus</th>
              </tr>
            </thead>
            <tbody>
              ${birthdayListHtml}
            </tbody>
          </table>

          <div style="background: #dbeafe; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Action:</strong> Don't forget to reach out and wish them a happy birthday! A personal call or message can make their day special.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl}/members?tab=birthdays" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">View All Birthdays</a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Sent from Church Management System</p>
        </div>
      </body>
      </html>
    `;

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject: `🎉 Today's Birthdays: ${data.todaysBirthdays.length} member${data.todaysBirthdays.length > 1 ? 's' : ''} celebrating!`,
      html,
    });
  }

  async sendLeadershipAssignmentNotification(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    groupName: string;
    assignedBy: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">Leadership Assignment Notification</h1>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>We are excited to inform you that you have been assigned a leadership role in our church!</p>
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your New Role:</h3>
          <p><strong>Position:</strong> ${data.role}</p>
          <p><strong>Group:</strong> ${data.groupName}</p>
          <p><strong>Assigned by:</strong> ${data.assignedBy}</p>
        </div>
        <p>This is a wonderful opportunity to serve and make a positive impact in our church community. We believe God has equipped you for this role!</p>
        <p>Our leadership team will be in touch with you soon to provide more details about your responsibilities and to offer any support you may need.</p>
        <p>Congratulations and God bless!</p>
        <p>In His Service,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: `Leadership Assignment: ${data.role} - ${data.groupName}`,
      html,
    });
  }

  // New methods for first-timer management
  async sendFirstTimerAssignmentNotification(data: {
    assigneeEmail: string;
    assigneeName: string;
    firstTimers: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      dateOfVisit: string;
    }>;
    assignedBy: string;
  }): Promise<void> {
    const firstTimersList = data.firstTimers
      .map(
        (ft) =>
          `<li><strong>${ft.firstName} ${ft.lastName}</strong> - ${ft.phone}${
            ft.email ? ` (${ft.email})` : ''
          } - Visited: ${ft.dateOfVisit}</li>`,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">First-Timer Assignment Notification</h1>
        <p>Dear ${data.assigneeName},</p>
        <p>You have been assigned to follow up with the following first-timer(s) by ${data.assignedBy}:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Assigned First-Timers:</h3>
          <ul style="list-style-type: none; padding: 0;">
            ${firstTimersList}
          </ul>
        </div>
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Follow-up Guidelines:</h3>
          <ul>
            <li>Contact each person within 24-48 hours</li>
            <li>Complete 4 call reports for each first-timer</li>
            <li>Track service attendance (2nd, 3rd, and 4th services)</li>
            <li>Update their integration stage as they progress</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.frontendUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Login to View Details
          </a>
        </div>
        <p>Thank you for your commitment to following up with our visitors!</p>
        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.assigneeEmail,
      subject: 'First-Timer Follow-up Assignment',
      html,
    });
  }

  async sendUnitLeaderNotification(data: {
    leaderEmail: string;
    leaderName: string;
    noMessageFirstTimers: Array<{
      firstName: string;
      lastName: string;
      dateOfVisit: string;
    }>;
  }): Promise<void> {
    const firstTimersList = data.noMessageFirstTimers
      .map(
        (ft) =>
          `<li>${ft.firstName} ${ft.lastName} - Visited: ${ft.dateOfVisit}</li>`,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e74c3c;">Action Required: Pre-filled Message Missing</h1>
        <p>Dear ${data.leaderName},</p>
        <p>The following first-timer(s) do not have a pre-filled message set and it's been more than 2 hours since their last submission:</p>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>First-Timers Requiring Attention:</h3>
          <ul>
            ${firstTimersList}
          </ul>
        </div>
        <p>Please log in to the church management system to set pre-filled messages for these visitors.</p>
        <p>This ensures they receive timely follow-up communication.</p>
        <p>Best regards,<br/>Church Management System</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.leaderEmail,
      subject: 'Action Required: Set Pre-filled Messages for First-Timers',
      html,
    });
  }

  async sendDistrictPastorNotification(data: {
    pastorEmail: string;
    pastorName: string;
    newMembers: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      integratedDate: string;
    }>;
    districtName: string;
  }): Promise<void> {
    const membersList = data.newMembers
      .map(
        (member) =>
          `<li><strong>${member.firstName} ${member.lastName}</strong> - ${
            member.phone
          }${
            member.email ? ` (${member.email})` : ''
          } - Integrated: ${member.integratedDate}</li>`,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">New District Members Assignment</h1>
        <p>Dear Pastor ${data.pastorName},</p>
        <p>We're excited to inform you that new members have been assigned to your district: <strong>${data.districtName}</strong></p>
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>New Members:</h3>
          <ul style="list-style-type: none; padding: 0;">
            ${membersList}
          </ul>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Next Steps:</h3>
          <ul>
            <li>Welcome them to your district</li>
            <li>Invite them to district activities</li>
            <li>Help them connect with other district members</li>
            <li>Continue their spiritual growth journey</li>
          </ul>
        </div>
        <p>Thank you for your leadership and commitment to nurturing our new members!</p>
        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.pastorEmail,
      subject: `New Members Assigned to ${data.districtName}`,
      html,
    });
  }

  // Job-specific email methods
  async sendFirstTimerThankYouEmail(data: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Thank You for Visiting!</h1>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>Thank you for visiting our church! We hope you felt the love of Christ and experienced meaningful worship with us.</p>
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>We're Here for You</h3>
          <p>Our follow-up team will be reaching out to you soon to:</p>
          <ul>
            <li>Answer any questions you might have</li>
            <li>Help you get connected with our community</li>
            <li>Share information about our ministries and activities</li>
          </ul>
        </div>
        <p>We would love to have you visit again and become part of our church family!</p>
        <p>God bless you,<br/>The Church Family</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: 'Thank You for Visiting Our Church!',
      html,
    });
  }

  async sendConversionNotification(data: {
    giaLeaderEmail: string;
    giaLeaderName: string;
    firstTimerName: string;
    memberName: string;
    conversionDate: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">🎉 Praise Report: First-Timer Conversion!</h1>
        <p>Dear ${data.giaLeaderName},</p>
        <p>We have wonderful news to share with you!</p>
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Conversion Update</h3>
          <p><strong>First-Timer:</strong> ${data.firstTimerName}</p>
          <p><strong>New Member Record:</strong> ${data.memberName}</p>
          <p><strong>Conversion Date:</strong> ${data.conversionDate}</p>
        </div>
        <p>This first-timer has successfully been converted to a full member of our church! Thank you for your role in their spiritual journey.</p>
        <p>Please continue to support and encourage them as they grow in their faith.</p>
        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.giaLeaderEmail,
      subject: '🎉 First-Timer Conversion Success!',
      html,
    });
  }

  async sendWeeklyMeetingReminder(data: {
    email: string;
    firstName: string;
    lastName: string;
    meetingDetails?: {
      date: string;
      time: string;
      location: string;
    };
  }): Promise<void> {
    const meetingInfo = data.meetingDetails
      ? `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Meeting Details</h3>
          <p><strong>Date:</strong> ${data.meetingDetails.date}</p>
          <p><strong>Time:</strong> ${data.meetingDetails.time}</p>
          <p><strong>Location:</strong> ${data.meetingDetails.location}</p>
        </div>
      `
      : `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>Please contact our church office for specific meeting details.</p>
        </div>
      `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Weekly Meeting Reminder</h1>
        <p>Dear ${data.firstName} ${data.lastName},</p>
        <p>We hope you're doing well! This is a friendly reminder about our upcoming weekly meeting.</p>
        ${meetingInfo}
        <p>We would love to see you there! It's a great opportunity for fellowship, prayer, and spiritual growth.</p>
        <p>If you have any questions or need directions, please don't hesitate to contact us.</p>
        <p>Looking forward to seeing you,<br/>The Church Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: 'Weekly Meeting Reminder',
      html,
    });
  }

  async sendFollowUpTaskNotification(data: {
    assignedPersonEmail: string;
    assignedPersonName: string;
    firstTimerName: string;
    taskType: string;
    urgency: 'low' | 'medium' | 'high';
    daysOverdue?: number;
  }): Promise<void> {
    const urgencyColors = {
      low: '#17a2b8',
      medium: '#ffc107',
      high: '#dc3545',
    };

    const urgencyMessages = {
      low: 'Please follow up when convenient',
      medium: 'Follow-up needed soon',
      high: 'Urgent follow-up required',
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${urgencyColors[data.urgency]};">Follow-up Task Notification</h1>
        <p>Dear ${data.assignedPersonName},</p>
        <p>You have a follow-up task that requires your attention:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColors[data.urgency]};">
          <h3>Task Details</h3>
          <p><strong>First-Timer:</strong> ${data.firstTimerName}</p>
          <p><strong>Task Type:</strong> ${data.taskType}</p>
          <p><strong>Priority:</strong> ${urgencyMessages[data.urgency]}</p>
          ${data.daysOverdue ? `<p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>` : ''}
        </div>
        <p>Please log in to the church management system to complete this follow-up task.</p>
        <p>Thank you for your dedication to following up with our visitors!</p>
        <p>Blessings,<br/>The Church Management System</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.assignedPersonEmail,
      subject: `Follow-up Task: ${data.firstTimerName} - ${data.urgency.toUpperCase()} Priority`,
      html,
    });
  }

  async sendBulkAssignmentNotification(data: {
    assigneeEmail: string;
    assigneeName: string;
    assignments: Array<{
      type: 'first_timer' | 'member' | 'district';
      name: string;
      details: string;
    }>;
    assignedBy: string;
  }): Promise<void> {
    const assignmentsList = data.assignments
      .map(
        (assignment) => `
        <li style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
          <strong>${assignment.name}</strong> (${assignment.type.replace('_', ' ')})
          <br><small>${assignment.details}</small>
        </li>
      `,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Bulk Assignment Notification</h1>
        <p>Dear ${data.assigneeName},</p>
        <p>You have received multiple new assignments from ${data.assignedBy}:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your New Assignments:</h3>
          <ul style="list-style: none; padding: 0;">
            ${assignmentsList}
          </ul>
        </div>
        <p>Please log in to the church management system to review and begin working on these assignments.</p>
        <p>Thank you for your service!</p>
        <p>Blessings,<br/>The Powerpoint Tribe Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.assigneeEmail,
      subject: `New Assignments from ${data.assignedBy}`,
      html,
    });
  }

  async sendMemberCreationNotification(data: {
    adminEmail: string;
    adminName: string;
    memberName: string;
    memberEmail: string;
    firstTimerId: string;
    conversionDate: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">✅ Member Record Created Successfully</h1>
        <p>Dear ${data.adminName},</p>
        <p>A new member record has been successfully created from a first-timer conversion:</p>
        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>New Member Details</h3>
          <p><strong>Member Name:</strong> ${data.memberName}</p>
          <p><strong>Email:</strong> ${data.memberEmail}</p>
          <p><strong>Original First-Timer ID:</strong> ${data.firstTimerId}</p>
          <p><strong>Conversion Date:</strong> ${data.conversionDate}</p>
        </div>
        <p>The first-timer record has been updated to reflect this conversion. The new member can now access member-specific features and services.</p>
        <p>Best regards,<br/>Church Management System</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.adminEmail,
      subject: `✅ New Member Created: ${data.memberName}`,
      html,
    });
  }

  async sendMemberFollowupAssignmentNotification(data: {
    memberEmail: string;
    memberName: string;
    firstTimers: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      dateOfVisit: string;
    }>;
    assignmentType: 'assignment' | 'followup';
    assignedBy: string;
  }): Promise<void> {
    const firstTimersList = data.firstTimers
      .map(
        (ft) =>
          `<li style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>${ft.firstName} ${ft.lastName}</strong><br/>
            📞 ${ft.phone}${ft.email ? `<br/>📧 ${ft.email}` : ''}<br/>
            🗓️ Visit Date: ${ft.dateOfVisit}
          </li>`,
      )
      .join('');

    const actionType =
      data.assignmentType === 'followup' ? 'follow up with' : 'assigned to';
    const titleType =
      data.assignmentType === 'followup' ? 'Follow-Up' : 'Assignment';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📋 New First-Timer ${titleType}</h1>
        </div>

        <div style="padding: 30px; background: white; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${data.memberName},</p>

          <p>You have been <strong>${actionType}</strong> the following first-timer(s) by ${data.assignedBy}:</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="color: #333; margin-top: 0;">👥 Your Assigned First-Timers:</h3>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              ${firstTimersList}
            </ul>
          </div>

          <div style="background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">📝 ${titleType} Guidelines:</h3>
            <ul style="color: #555; margin-bottom: 0;">
              <li style="margin-bottom: 8px;">✅ <strong>Contact within 24-48 hours</strong> - First impressions matter!</li>
              <li style="margin-bottom: 8px;">📞 <strong>Complete 4 call reports</strong> for each first-timer to track progress</li>
              <li style="margin-bottom: 8px;">⛪ <strong>Track service attendance</strong> (2nd, 3rd, and 4th services)</li>
              <li style="margin-bottom: 8px;">📈 <strong>Update integration stages</strong> as they progress in their journey</li>
              <li style="margin-bottom: 8px;">❤️ <strong>Show genuine care</strong> and help them feel welcomed in our church family</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; color: #2d5f2d; font-weight: 500;">
              💡 <strong>Remember:</strong> Your role is crucial in helping these visitors feel connected and welcomed.
              Each person represents someone God has brought to our church family!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.frontendUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Login to View Details
            </a>
          </div>

          <p style="margin-top: 30px;">Thank you for your heart for people and your commitment to excellent follow-up!</p>

          <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #777;">
              Blessings,<br/>
              <strong>The Powerpoint Tribe Leadership Team</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.memberEmail,
      subject: `🔔 ${titleType} Notification: ${data.firstTimers.length} First-Timer(s) Assigned to You`,
      html,
    });
  }

  /**
   * Send a custom email with provided subject and HTML content
   * Useful for message drafts and other dynamic content
   */
  async sendCustomEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    await this.emailProvider.sendEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  /**
   * Send a scheduled follow-up reminder to the assigned person
   * This is triggered by a delayed job at the user-specified time
   */
  async sendScheduledFollowUpReminder(data: {
    assignedPersonEmail: string;
    assignedPersonName: string;
    firstTimerName: string;
    firstTimerPhone: string;
    firstTimerEmail?: string;
    followUpNotes?: string;
    scheduledTime: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⏰ Follow-Up Reminder</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Scheduled for ${data.scheduledTime}</p>
        </div>

        <div style="padding: 30px; background: white; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${data.assignedPersonName},</p>

          <p>This is your scheduled reminder to follow up with:</p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f5576c;">
            <h3 style="color: #333; margin-top: 0;">👤 ${data.firstTimerName}</h3>
            <p style="margin: 10px 0;">📞 <strong>Phone:</strong> ${data.firstTimerPhone}</p>
            ${data.firstTimerEmail ? `<p style="margin: 10px 0;">📧 <strong>Email:</strong> ${data.firstTimerEmail}</p>` : ''}
            ${data.followUpNotes ? `<p style="margin: 10px 0;">📝 <strong>Notes:</strong> ${data.followUpNotes}</p>` : ''}
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; color: #856404; font-weight: 500;">
              💡 <strong>Tip:</strong> A timely follow-up shows you care and helps build lasting connections!
            </p>
          </div>

          <p style="margin-top: 30px;">Please reach out to them as soon as possible.</p>

          <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #777;">
              Blessings,<br/>
              <strong>Church Management System</strong>
            </p>
          </div>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.assignedPersonEmail,
      subject: `⏰ Follow-Up Reminder: ${data.firstTimerName}`,
      html,
    });
  }

  // ========== LBS EVENT EMAIL TEMPLATES ==========

  /**
   * Send event registration confirmation with QR code
   */
  async sendEventRegistrationConfirmation(data: {
    email: string;
    firstName: string;
    lastName: string;
    eventTitle: string;
    eventDate: Date | string;
    eventLocation?: any;
    checkInCode: string;
    customFieldResponses?: Map<string, string> | Record<string, string>;
  }): Promise<void> {
    const eventDate =
      data.eventDate instanceof Date
        ? data.eventDate
        : new Date(data.eventDate);

    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const cfr = data.customFieldResponses;
    const track =
      cfr instanceof Map ? cfr.get('track') || '' : (cfr as any)?.track || '';
    const locationStr =
      typeof data.eventLocation === 'string'
        ? data.eventLocation
        : data.eventLocation?.name || '';

    // Split 4-digit code into individual digits for styled display
    const codeDigits = data.checkInCode
      .split('')
      .map(
        (d) =>
          `<td style="width:52px;height:64px;background:#0D7770;color:#ffffff;font-family:'Courier New',monospace;font-size:28px;font-weight:700;text-align:center;border-radius:10px;letter-spacing:0;">${d}</td>`,
      )
      .join('<td style="width:8px;"></td>');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <!-- Header -->
        <div style="background:#0D7770;padding:48px 32px 40px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;margin-bottom:16px;">&#10003;</div>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">You're In!</h1>
          <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);font-weight:400;">${data.eventTitle}</p>
        </div>

        <!-- Body -->
        <div style="padding:36px 32px;">
          <p style="font-size:16px;color:#1a1a1a;margin:0 0 20px;font-weight:500;">Hi ${data.firstName},</p>
          <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.65;">Your registration for <strong style="color:#1a1a1a;">${data.eventTitle}</strong> is confirmed. Here's everything you need.</p>

          <!-- Check-In Code -->
          <div style="background:#f8fafa;border:1px solid #e8eded;border-radius:12px;padding:28px 20px;text-align:center;margin:0 0 28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#0D7770;">Your Check-In Code</p>
            <table style="margin:16px auto 12px;border-spacing:0;" cellpadding="0" cellspacing="0"><tr>${codeDigits}</tr></table>
            <p style="margin:0;font-size:12px;color:#888;">Show this code at the door for instant check-in</p>
          </div>

          <!-- Event Details -->
          <div style="border-radius:12px;overflow:hidden;margin:0 0 28px;border:1px solid #eee;">
            <div style="background:#fafafa;padding:16px 20px;border-bottom:1px solid #eee;">
              <p style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Event Details</p>
            </div>
            <div style="padding:16px 20px;">
              <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;color:#0D7770;font-size:14px;">&#128197;</td>
                  <td style="padding:8px 0;font-size:14px;color:#333;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;color:#0D7770;font-size:14px;">&#128336;</td>
                  <td style="padding:8px 0;font-size:14px;color:#333;">${formattedTime}</td>
                </tr>
                ${
                  locationStr
                    ? `<tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;color:#0D7770;font-size:14px;">&#128205;</td>
                  <td style="padding:8px 0;font-size:14px;color:#333;">${locationStr}</td>
                </tr>`
                    : ''
                }
                ${
                  track
                    ? `<tr>
                  <td style="padding:8px 0;vertical-align:top;width:24px;color:#0D7770;font-size:14px;">&#127919;</td>
                  <td style="padding:8px 0;font-size:14px;color:#333;">${track}</td>
                </tr>`
                    : ''
                }
              </table>
            </div>
          </div>

          <!-- Preparation -->
          <div style="margin:0 0 28px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Before the event:</p>
            <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;font-size:13px;color:#555;">&#9679;&nbsp; Screenshot this email or save your check-in code</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#555;">&#9679;&nbsp; Arrive 15 minutes early for networking</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#555;">&#9679;&nbsp; Bring a valid ID for verification</td></tr>
              <tr><td style="padding:6px 0;font-size:13px;color:#555;">&#9679;&nbsp; Dress code: Business professional</td></tr>
            </table>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin:32px 0 0;">
            <p style="margin:0;font-size:14px;color:#555;">See you there!</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:24px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#aaa;">Questions? <a href="mailto:info@powerpointtribe.org" style="color:#0D7770;text-decoration:none;">info@powerpointtribe.org</a></p>
          <p style="margin:0;font-size:11px;color:#ccc;">&copy; ${new Date().getFullYear()} PowerPoint Tribe</p>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: `You're registered - ${data.eventTitle}`,
      html,
    });
  }

  /**
   * Send partnership inquiry confirmation to partner
   */
  async sendPartnerInquiryConfirmation(data: {
    email: string;
    name: string;
    company?: string;
    eventTitle: string;
  }): Promise<void> {
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <!-- Header -->
        <div style="background:#1E40AF;padding:48px 32px 40px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;margin-bottom:16px;">&#129309;</div>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Inquiry Received</h1>
          <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);">${data.eventTitle} Partnership</p>
        </div>

        <!-- Body -->
        <div style="padding:36px 32px;">
          <p style="font-size:16px;color:#1a1a1a;margin:0 0 20px;font-weight:500;">Hi ${data.name},</p>
          <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.65;">Thank you for your interest in partnering with us for <strong style="color:#1a1a1a;">${data.eventTitle}</strong>. We've received your inquiry${data.company ? ` on behalf of <strong style="color:#1a1a1a;">${data.company}</strong>` : ''} and are excited to explore this with you.</p>

          <!-- Timeline -->
          <div style="margin:0 0 28px;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">What happens next</p>

            <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:40px;vertical-align:top;padding:0 0 20px;">
                  <div style="width:32px;height:32px;background:#1E40AF;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-size:13px;font-weight:700;">1</div>
                </td>
                <td style="padding:0 0 20px;vertical-align:top;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1a1a1a;">Review</p>
                  <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">Our partnerships team will review your inquiry within 24&ndash;48 hours.</p>
                </td>
              </tr>
              <tr>
                <td style="width:40px;vertical-align:top;padding:0 0 20px;">
                  <div style="width:32px;height:32px;background:#1E40AF;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-size:13px;font-weight:700;">2</div>
                </td>
                <td style="padding:0 0 20px;vertical-align:top;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1a1a1a;">Discussion</p>
                  <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">We'll reach out to discuss opportunities and answer your questions.</p>
                </td>
              </tr>
              <tr>
                <td style="width:40px;vertical-align:top;padding:0;">
                  <div style="width:32px;height:32px;background:#1E40AF;border-radius:50%;text-align:center;line-height:32px;color:#fff;font-size:13px;font-weight:700;">3</div>
                </td>
                <td style="padding:0;vertical-align:top;">
                  <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1a1a1a;">Partnership Package</p>
                  <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">You'll receive details on available tiers, benefits, and pricing.</p>
                </td>
              </tr>
            </table>
          </div>

          <!-- Benefits -->
          <div style="background:#f8f9fb;border:1px solid #eee;border-radius:12px;padding:24px;margin:0 0 28px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Partner benefits include</p>
            <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#555;">&#10003;&nbsp; Brand visibility to hundreds of professionals</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#555;">&#10003;&nbsp; Networking with industry leaders</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#555;">&#10003;&nbsp; Speaking and presentation opportunities</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#555;">&#10003;&nbsp; Booth space for product showcase</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#555;">&#10003;&nbsp; Digital marketing across our platforms</td>
              </tr>
            </table>
          </div>

          <!-- Contact -->
          <div style="background:#f0f4ff;border:1px solid #dde4f0;border-radius:10px;padding:16px 20px;margin:0 0 28px;">
            <p style="margin:0;font-size:13px;color:#555;">Need to speak with us sooner? Reach out at <a href="mailto:partnerships@powerpointtribe.org" style="color:#1E40AF;text-decoration:none;font-weight:600;">partnerships@powerpointtribe.org</a></p>
          </div>

          <p style="margin:0;font-size:14px;color:#555;">We look forward to working together.</p>
        </div>

        <!-- Footer -->
        <div style="padding:24px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0 0 2px;font-size:12px;color:#999;">The Partnerships Team &middot; PowerPoint Tribe</p>
          <p style="margin:0;font-size:11px;color:#ccc;">&copy; ${new Date().getFullYear()} PowerPoint Tribe</p>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: `Partnership Inquiry Received - ${data.eventTitle}`,
      html,
    });
  }

  /**
   * Send partnership inquiry notification to admin team
   */
  async sendPartnerInquiryToAdmin(data: {
    adminEmail: string;
    partnerName: string;
    partnerEmail: string;
    partnerCompany?: string;
    partnerPhone: string;
    eventTitle: string;
    interestDetails: string;
    partnerId: string;
  }): Promise<void> {
    const viewUrl = `${this.frontendUrl}/events/partners?id=${data.partnerId}`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <!-- Header -->
        <div style="background:#B91C1C;padding:40px 32px 36px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;font-size:24px;margin-bottom:14px;">&#128276;</div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">New Partnership Inquiry</h1>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${data.eventTitle}</p>
        </div>

        <!-- Body -->
        <div style="padding:32px;">
          <!-- Partner Info Card -->
          <div style="border:1px solid #eee;border-radius:12px;overflow:hidden;margin:0 0 24px;">
            <div style="background:#fafafa;padding:14px 20px;border-bottom:1px solid #eee;">
              <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Partner Information</p>
            </div>
            <div style="padding:16px 20px;">
              <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:7px 0;font-size:12px;color:#999;width:80px;vertical-align:top;">Name</td>
                  <td style="padding:7px 0;font-size:14px;color:#1a1a1a;font-weight:500;">${data.partnerName}</td>
                </tr>
                ${
                  data.partnerCompany
                    ? `<tr>
                  <td style="padding:7px 0;font-size:12px;color:#999;vertical-align:top;">Company</td>
                  <td style="padding:7px 0;font-size:14px;color:#1a1a1a;font-weight:500;">${data.partnerCompany}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:7px 0;font-size:12px;color:#999;vertical-align:top;">Email</td>
                  <td style="padding:7px 0;font-size:14px;"><a href="mailto:${data.partnerEmail}" style="color:#1E40AF;text-decoration:none;">${data.partnerEmail}</a></td>
                </tr>
                ${
                  data.partnerPhone
                    ? `<tr>
                  <td style="padding:7px 0;font-size:12px;color:#999;vertical-align:top;">Phone</td>
                  <td style="padding:7px 0;font-size:14px;color:#1a1a1a;">${data.partnerPhone}</td>
                </tr>`
                    : ''
                }
              </table>
            </div>
          </div>

          <!-- Interest Details -->
          ${
            data.interestDetails
              ? `
          <div style="background:#fffbf0;border:1px solid #f0e6cc;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#b08d3a;">Interest Details</p>
            <p style="margin:0;font-size:13px;color:#666;line-height:1.6;white-space:pre-wrap;">${data.interestDetails}</p>
          </div>
          `
              : ''
          }

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0;">
            <a href="${viewUrl}" style="display:inline-block;background:#1E40AF;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Dashboard</a>
          </div>

          <!-- Action notice -->
          <div style="background:#f0faf0;border:1px solid #d4edda;border-radius:10px;padding:14px 20px;">
            <p style="margin:0;font-size:13px;color:#2e7d32;">Respond within 24&ndash;48 hours to maintain partner interest.</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#ccc;">Automated notification &middot; Church Management System</p>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.adminEmail,
      subject: `New Partnership Inquiry - ${data.partnerName}${data.partnerCompany ? ` (${data.partnerCompany})` : ''}`,
      html,
    });
  }

  /**
   * Send event reminder (T-7, T-3, T-1 days)
   */
  async sendEventReminder(data: {
    email: string;
    firstName: string;
    lastName: string;
    eventTitle: string;
    eventDate: Date;
    eventLocation?: string;
    checkInCode: string;
    daysUntil: number;
  }): Promise<void> {
    const formattedDate = data.eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedTime = data.eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    let reminderTitle = '';
    let headerColor = '';
    let headerSubtext = '';

    if (data.daysUntil === 1) {
      reminderTitle = 'Tomorrow';
      headerColor = '#B91C1C';
      headerSubtext = 'Final check before the big day';
    } else if (data.daysUntil === 3) {
      reminderTitle = '3 Days Left';
      headerColor = '#0D7770';
      headerSubtext = 'Time to start preparing';
    } else {
      reminderTitle = `${data.daysUntil} Days Left`;
      headerColor = '#1E40AF';
      headerSubtext = 'Mark your calendar';
    }

    // Build checklist items based on urgency
    const checklistItems =
      data.daysUntil === 1
        ? [
            'Have your check-in code ready (see below)',
            'Plan your route and parking',
            'Bring a valid ID for verification',
            'Charge your devices for networking',
            'Dress code: Business professional',
          ]
        : data.daysUntil === 3
          ? [
              'Review the event schedule',
              'Prepare business cards for networking',
              'Set a calendar reminder',
              'Review speaker profiles and topics',
            ]
          : [
              'Save the event date in your calendar',
              'Review pre-event materials (if provided)',
              'Prepare questions for Q&A sessions',
              'Connect with other attendees on social media',
            ];

    const checklistHtml = checklistItems
      .map(
        (item) =>
          `<tr><td style="padding:5px 0;font-size:13px;color:#555;">&#9679;&nbsp; ${item}</td></tr>`,
      )
      .join('');

    // Build 4-digit code display
    const codeDigits = data.checkInCode
      .split('')
      .map(
        (d) =>
          `<td style="width:48px;height:60px;background:${headerColor};color:#ffffff;font-family:'Courier New',monospace;font-size:26px;font-weight:700;text-align:center;border-radius:10px;">${d}</td>`,
      )
      .join('<td style="width:6px;"></td>');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <!-- Header -->
        <div style="background:${headerColor};padding:48px 32px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:48px;font-weight:700;color:#ffffff;letter-spacing:-1px;">${reminderTitle}</p>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">${headerSubtext}</p>
        </div>

        <!-- Body -->
        <div style="padding:36px 32px;">
          <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;font-weight:500;">Hi ${data.firstName},</p>
          <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.65;"><strong style="color:#1a1a1a;">${data.eventTitle}</strong> is ${data.daysUntil === 1 ? 'tomorrow' : `in ${data.daysUntil} days`}. Here's a quick refresher.</p>

          <!-- Event Details -->
          <div style="border:1px solid #eee;border-radius:12px;overflow:hidden;margin:0 0 24px;">
            <div style="background:#fafafa;padding:14px 20px;border-bottom:1px solid #eee;">
              <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Event Details</p>
            </div>
            <div style="padding:16px 20px;">
              <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:#333;">&#128197;&nbsp; ${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:7px 0;font-size:14px;color:#333;">&#128336;&nbsp; ${formattedTime}</td>
                </tr>
                ${
                  data.eventLocation
                    ? `<tr><td style="padding:7px 0;font-size:14px;color:#333;">&#128205;&nbsp; ${data.eventLocation}</td></tr>`
                    : ''
                }
              </table>
            </div>
          </div>

          <!-- Check-In Code -->
          <div style="background:#f8fafa;border:1px solid #e8eded;border-radius:12px;padding:24px 20px;text-align:center;margin:0 0 24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:${headerColor};">Your Check-In Code</p>
            <table style="margin:14px auto 10px;border-spacing:0;" cellpadding="0" cellspacing="0"><tr>${codeDigits}</tr></table>
            <p style="margin:0;font-size:12px;color:#888;">Show this at the door for instant check-in</p>
          </div>

          <!-- Checklist -->
          <div style="margin:0 0 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1a1a1a;">Preparation checklist:</p>
            <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
              ${checklistHtml}
            </table>
          </div>

          ${
            data.daysUntil === 1
              ? `
          <div style="background:#fff8f0;border:1px solid #f0e0cc;border-radius:10px;padding:14px 20px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#8a6d3b;">Arrive 15&ndash;20 minutes early for registration and networking.</p>
          </div>
          `
              : ''
          }

          <div style="text-align:center;margin:28px 0 0;">
            <p style="margin:0;font-size:14px;color:#555;">See you ${data.daysUntil === 1 ? 'tomorrow' : 'soon'}!</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:24px 32px;border-top:1px solid #f0f0f0;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#aaa;">Questions? <a href="mailto:info@powerpointtribe.org" style="color:${headerColor};text-decoration:none;">info@powerpointtribe.org</a></p>
          <p style="margin:0;font-size:11px;color:#ccc;">&copy; ${new Date().getFullYear()} PowerPoint Tribe</p>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: `${data.eventTitle} - ${reminderTitle}`,
      html,
    });
  }

  async sendReadyForIntegrationNotification(data: {
    recipientEmail: string;
    recipientName: string;
    firstTimerName: string;
    markedBy: string;
    markedAt: string;
    firstTimerId: string;
  }): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: table-cell; vertical-align: middle; text-align: center; font-size: 28px;">&#128100;</div>
            <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px;">Ready for Integration</h1>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">A first-timer has been marked ready to become a member</p>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">First-Timer</p>
            <p style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">${data.firstTimerName}</p>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 8px 8px 8px 0; font-size: 13px; color: #6b7280; width: 40%;">Marked By</td>
              <td style="padding: 8px 0 8px 8px; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${data.markedBy}</td>
            </tr>
            <tr>
              <td style="padding: 8px 8px 8px 0; font-size: 13px; color: #6b7280; width: 40%;">Date</td>
              <td style="padding: 8px 0 8px 8px; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${new Date(data.markedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            </tr>
          </table>

          <div style="text-align: center;">
            <a href="${this.frontendUrl}/first-timers/${data.firstTimerId}" style="display: inline-block; padding: 12px 28px; background: #10b981; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">View First-Timer Profile</a>
          </div>

          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">You are receiving this because you have the integration notification permission.</p>
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject: `${data.firstTimerName} is Ready for Integration`,
      html,
    });
  }
}

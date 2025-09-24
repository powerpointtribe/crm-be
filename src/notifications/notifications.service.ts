import { Injectable } from '@nestjs/common';
import { EmailProvider } from './providers/email.provider';

@Injectable()
export class NotificationsService {
  constructor(private emailProvider: EmailProvider) {}

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
        <p>Blessings,<br/>The Church Leadership Team</p>
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
        <p>In His Service,<br/>The Church Leadership Team</p>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject: `Leadership Assignment: ${data.role} - ${data.groupName}`,
      html,
    });
  }
}

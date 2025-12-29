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
}

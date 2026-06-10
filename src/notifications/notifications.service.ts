import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './providers/email.provider';
import { EmailTemplateResolverService } from '../bulk-email/email-template-resolver.service';

@Injectable()
export class NotificationsService {
  private readonly frontendUrl: string;

  constructor(
    private emailProvider: EmailProvider,
    private configService: ConfigService,
    private templateResolver: EmailTemplateResolverService,
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
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'members.welcome',
      { firstName: memberData.firstName, lastName: memberData.lastName },
    );

    await this.emailProvider.sendEmail({
      to: memberData.email,
      subject,
      html,
    });
  }

  async sendFirstTimerFollowUp(firstTimerData: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.follow-up',
      { firstName: firstTimerData.firstName, lastName: firstTimerData.lastName },
    );

    await this.emailProvider.sendEmail({
      to: firstTimerData.email,
      subject,
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
    const firstTimersList = '<ul>' + userData.assignedFirstTimers
      .map(
        (ft) =>
          `<li>${ft.name} (${ft.phone}) - ${ft.daysSinceVisit} days since visit</li>`,
      )
      .join('') + '</ul>';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.follow-up-reminder',
      { firstName: userData.firstName, firstTimersList },
    );

    await this.emailProvider.sendEmail({
      to: userData.email,
      subject,
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
    const meetingDateTime = `${data.meetingDate.toLocaleDateString()} at ${data.meetingDate.toLocaleTimeString()}`;
    const hostHtml = data.hostName ? `<p><strong>Host:</strong> ${data.hostName}</p>` : '';

    const { subject, html: templateHtml } = await this.templateResolver.resolveTemplate(
      'groups.meeting-reminder',
      {
        name: '{{name}}',
        districtName: data.districtName,
        meetingDateTime,
        location: data.location,
        hostHtml,
      },
    );

    await this.emailProvider.sendBulkEmail({
      recipients: data.recipients.map((r) => ({
        email: r.email,
        name: r.firstName,
      })),
      subject,
      html: templateHtml,
    });
  }

  async sendBirthdayWishes(memberData: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'members.birthday-wishes',
      { firstName: memberData.firstName },
    );

    await this.emailProvider.sendEmail({
      to: memberData.email,
      subject,
      html,
    });
  }

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

    const birthdayListHtml = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <thead><tr style="background: #f9fafb;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Campus</th>
      </tr></thead><tbody>${data.upcomingBirthdays
      .map(
        (member) => `<tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>${member.firstName} ${member.lastName}</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.phone || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.email || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.branch || '-'}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'members.pre-birthday-notification',
      {
        recipientName: data.recipientName,
        formattedDate,
        birthdayListHtml,
        memberCount: String(data.upcomingBirthdays.length),
        frontendUrl: data.frontendUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
    });
  }

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
    const todayDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const birthdayListHtml = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <thead><tr style="background: #f9fafb;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Campus</th>
      </tr></thead><tbody>${data.todaysBirthdays
      .map(
        (member) => `<tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>${member.firstName} ${member.lastName}</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.phone || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.email || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${member.branch || '-'}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'members.birthday-day-notification',
      {
        recipientName: data.recipientName,
        todayDate,
        birthdayListHtml,
        memberCount: String(data.todaysBirthdays.length),
        frontendUrl: data.frontendUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject,
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
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'groups.leadership-assignment',
      {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        groupName: data.groupName,
        assignedBy: data.assignedBy,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
      html,
    });
  }

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
    const firstTimersList = '<ul style="list-style-type: none; padding: 0;">' + data.firstTimers
      .map(
        (ft) =>
          `<li><strong>${ft.firstName} ${ft.lastName}</strong> - ${ft.phone}${
            ft.email ? ` (${ft.email})` : ''
          } - Visited: ${ft.dateOfVisit}</li>`,
      )
      .join('') + '</ul>';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.assignment',
      {
        assigneeName: data.assigneeName,
        assignedBy: data.assignedBy,
        firstTimersList,
        frontendUrl: this.frontendUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.assigneeEmail,
      subject,
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
    const firstTimersList = '<ul>' + data.noMessageFirstTimers
      .map(
        (ft) =>
          `<li>${ft.firstName} ${ft.lastName} - Visited: ${ft.dateOfVisit}</li>`,
      )
      .join('') + '</ul>';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.unit-leader-notification',
      { leaderName: data.leaderName, firstTimersList },
    );

    await this.emailProvider.sendEmail({
      to: data.leaderEmail,
      subject,
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
    const membersList = '<ul style="list-style-type: none; padding: 0;">' + data.newMembers
      .map(
        (member) =>
          `<li><strong>${member.firstName} ${member.lastName}</strong> - ${
            member.phone
          }${
            member.email ? ` (${member.email})` : ''
          } - Integrated: ${member.integratedDate}</li>`,
      )
      .join('') + '</ul>';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'groups.district-pastor-notification',
      {
        pastorName: data.pastorName,
        districtName: data.districtName,
        membersList,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.pastorEmail,
      subject,
      html,
    });
  }

  async sendFirstTimerThankYouEmail(data: {
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<void> {
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.thank-you',
      { firstName: data.firstName, lastName: data.lastName },
    );

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
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
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.conversion',
      {
        giaLeaderName: data.giaLeaderName,
        firstTimerName: data.firstTimerName,
        memberName: data.memberName,
        conversionDate: data.conversionDate,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.giaLeaderEmail,
      subject,
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
    const meetingDetailsHtml = data.meetingDetails
      ? `<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Meeting Details</h3>
          <p><strong>Date:</strong> ${data.meetingDetails.date}</p>
          <p><strong>Time:</strong> ${data.meetingDetails.time}</p>
          <p><strong>Location:</strong> ${data.meetingDetails.location}</p>
        </div>`
      : `<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>Please contact our church office for specific meeting details.</p>
        </div>`;

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'groups.weekly-meeting-reminder',
      {
        firstName: data.firstName,
        lastName: data.lastName,
        meetingDetailsHtml,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
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

    const daysOverdueHtml = data.daysOverdue
      ? `<p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>`
      : '';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.follow-up-task',
      {
        assignedPersonName: data.assignedPersonName,
        firstTimerName: data.firstTimerName,
        taskType: data.taskType,
        urgency: data.urgency.toUpperCase(),
        urgencyColor: urgencyColors[data.urgency],
        urgencyMessage: urgencyMessages[data.urgency],
        daysOverdueHtml,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.assignedPersonEmail,
      subject,
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
    const assignmentsList = '<ul style="list-style: none; padding: 0;">' + data.assignments
      .map(
        (assignment) => `
        <li style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
          <strong>${assignment.name}</strong> (${assignment.type.replace('_', ' ')})
          <br><small>${assignment.details}</small>
        </li>`,
      )
      .join('') + '</ul>';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.bulk-assignment',
      {
        assigneeName: data.assigneeName,
        assignedBy: data.assignedBy,
        assignmentsList,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.assigneeEmail,
      subject,
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
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'members.creation-notification',
      {
        adminName: data.adminName,
        memberName: data.memberName,
        memberEmail: data.memberEmail,
        firstTimerId: data.firstTimerId,
        conversionDate: data.conversionDate,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.adminEmail,
      subject,
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
    const firstTimersList = '<ul style="list-style-type: none; padding: 0; margin: 0;">' + data.firstTimers
      .map(
        (ft) =>
          `<li style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>${ft.firstName} ${ft.lastName}</strong><br/>
            📞 ${ft.phone}${ft.email ? `<br/>📧 ${ft.email}` : ''}<br/>
            🗓️ Visit Date: ${ft.dateOfVisit}
          </li>`,
      )
      .join('') + '</ul>';

    const actionType =
      data.assignmentType === 'followup' ? 'follow up with' : 'assigned to';
    const titleType =
      data.assignmentType === 'followup' ? 'Follow-Up' : 'Assignment';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.member-followup-assignment',
      {
        memberName: data.memberName,
        assignedBy: data.assignedBy,
        titleType,
        actionType,
        count: String(data.firstTimers.length),
        firstTimersList,
        frontendUrl: this.frontendUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.memberEmail,
      subject,
      html,
    });
  }

  async sendFirstTimerBirthdayNotification(data: {
    recipientEmail: string;
    recipientName: string;
    firstTimerBirthdays: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      assignedTo?: string;
      followUpPerson?: string;
    }>;
    frontendUrl: string;
  }): Promise<void> {
    const todayDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    const birthdayListHtml = `<table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <thead><tr style="background: #f9fafb;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Name</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Email</th>
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Follow-up Person</th>
      </tr></thead><tbody>${data.firstTimerBirthdays
      .map(
        (ft) => `<tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><strong>${ft.firstName} ${ft.lastName}</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${ft.phone || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${ft.email || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${ft.followUpPerson || ft.assignedTo || '-'}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;

    const subject = `🎂 First Timer Birthday Alert - ${todayDate}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎂 First Timer Birthday Today!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${todayDate}</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin-top: 0;">Hi ${data.recipientName},</p>
          <p>The following first timer(s) currently being followed up are celebrating their birthday today. This is a great opportunity to reach out and wish them well! 🎉</p>
          ${birthdayListHtml}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.frontendUrl}/first-timers" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">View First Timers</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">A birthday call or message can make a lasting impression. Let's show them they're valued!</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Sent from Church Management System</p>
        </div>
      </body>
      </html>
    `;

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
    });
  }

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

  async sendScheduledFollowUpReminder(data: {
    assignedPersonEmail: string;
    assignedPersonName: string;
    firstTimerName: string;
    firstTimerPhone: string;
    firstTimerEmail?: string;
    followUpNotes?: string;
    scheduledTime: string;
  }): Promise<void> {
    const firstTimerEmailHtml = data.firstTimerEmail
      ? `<p style="margin: 10px 0;">📧 <strong>Email:</strong> ${data.firstTimerEmail}</p>`
      : '';
    const followUpNotesHtml = data.followUpNotes
      ? `<p style="margin: 10px 0;">📝 <strong>Notes:</strong> ${data.followUpNotes}</p>`
      : '';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.scheduled-reminder',
      {
        assignedPersonName: data.assignedPersonName,
        firstTimerName: data.firstTimerName,
        firstTimerPhone: data.firstTimerPhone,
        scheduledTime: data.scheduledTime,
        firstTimerEmailHtml,
        followUpNotesHtml,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.assignedPersonEmail,
      subject,
      html,
    });
  }

  /**
   * Build a "From" header for event emails. Returns a `Name <email>` string
   * when the event defines a custom sender, otherwise undefined so the email
   * provider falls back to the platform default sender.
   * NOTE: the sender domain must be verified on the configured email provider.
   */
  private buildSenderFrom(
    senderEmail?: string,
    senderName?: string,
    fallbackName?: string,
  ): string | undefined {
    if (!senderEmail) return undefined;
    const name = senderName || fallbackName;
    return name ? `${name} <${senderEmail}>` : senderEmail;
  }

  async sendEventRegistrationConfirmation(data: {
    email: string;
    firstName: string;
    lastName: string;
    eventTitle: string;
    eventDate: Date | string;
    eventLocation?: any;
    checkInCode: string;
    customFieldResponses?: Map<string, string> | Record<string, string>;
    confirmationTemplateId?: string;
    senderEmail?: string;
    senderName?: string;
    applicationUrl?: string;
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

    const checkInCodeHtml = data.checkInCode
      .split('')
      .map(
        (d) =>
          `<td style="width:52px;height:64px;background:#0D7770;color:#ffffff;font-family:'Courier New',monospace;font-size:28px;font-weight:700;text-align:center;border-radius:10px;">${d}</td>`,
      )
      .join('<td style="width:8px;"></td>');

    const locationHtml = locationStr
      ? `<tr><td style="padding:8px 0;color:#0D7770;font-size:14px;width:24px;">&#128205;</td><td style="padding:8px 0;font-size:14px;color:#333;">${locationStr}</td></tr>`
      : '';

    const trackHtml = track
      ? `<tr><td style="padding:8px 0;color:#0D7770;font-size:14px;width:24px;">&#127919;</td><td style="padding:8px 0;font-size:14px;color:#333;">${track}</td></tr>`
      : '';

    // Application form call-to-action. Rendered only when the event provides an
    // application URL (a per-registrant link to complete the full application).
    const applicationButtonHtml = data.applicationUrl
      ? `<div style="text-align:center;margin:24px 0 8px;">
          <a href="${data.applicationUrl}" style="display:inline-block;background:#c8a04a;color:#0f2545;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">Complete your application &rarr;</a>
          <p style="margin:12px 0 0;font-size:12px;color:#888;line-height:1.5;">This link is unique to you. Please complete it so we can review your application.</p>
        </div>`
      : '';

    const templateVars = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      eventTitle: data.eventTitle,
      checkInCode: data.checkInCode,
      checkInCodeHtml,
      formattedDate,
      formattedTime,
      locationHtml,
      trackHtml,
      applicationUrl: data.applicationUrl || '',
      applicationButtonHtml,
      year: String(new Date().getFullYear()),
    };

    let resolved: { subject: string; html: string } | null = null;

    if (data.confirmationTemplateId) {
      resolved = await this.templateResolver.resolveTemplateById(
        data.confirmationTemplateId,
        templateVars,
      );
    }

    if (!resolved) {
      resolved = await this.templateResolver.resolveTemplate(
        'events.registration-confirmation',
        templateVars,
      );
    }

    const { subject, html } = resolved;

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
      html,
      from: this.buildSenderFrom(
        data.senderEmail,
        data.senderName,
        data.eventTitle,
      ),
    });
  }

  async sendPartnerInquiryConfirmation(data: {
    email: string;
    name: string;
    company?: string;
    eventTitle: string;
  }): Promise<void> {
    const companyText = data.company
      ? ` on behalf of <strong style="color:#1a1a1a;">${data.company}</strong>`
      : '';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'events.partner-inquiry-confirmation',
      {
        name: data.name,
        eventTitle: data.eventTitle,
        companyText,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
      html,
    });
  }

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

    const partnerCompanyHtml = data.partnerCompany
      ? `<tr><td style="padding:7px 0;font-size:12px;color:#999;vertical-align:top;">Company</td><td style="padding:7px 0;font-size:14px;color:#1a1a1a;font-weight:500;">${data.partnerCompany}</td></tr>`
      : '';

    const partnerPhoneHtml = data.partnerPhone
      ? `<tr><td style="padding:7px 0;font-size:12px;color:#999;vertical-align:top;">Phone</td><td style="padding:7px 0;font-size:14px;color:#1a1a1a;">${data.partnerPhone}</td></tr>`
      : '';

    const interestDetailsHtml = data.interestDetails
      ? `<div style="background:#fffbf0;border:1px solid #f0e6cc;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#b08d3a;">Interest Details</p>
          <p style="margin:0;font-size:13px;color:#666;line-height:1.6;white-space:pre-wrap;">${data.interestDetails}</p>
        </div>`
      : '';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'events.partner-inquiry-admin',
      {
        partnerName: data.partnerName,
        partnerEmail: data.partnerEmail,
        eventTitle: data.eventTitle,
        viewUrl,
        companyText: data.partnerCompany ? ` (${data.partnerCompany})` : '',
        partnerCompanyHtml,
        partnerPhoneHtml,
        interestDetailsHtml,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.adminEmail,
      subject,
      html,
    });
  }

  async sendEventReminder(data: {
    email: string;
    firstName: string;
    lastName: string;
    eventTitle: string;
    eventDate: Date;
    eventLocation?: string;
    checkInCode: string;
    daysUntil: number;
    senderEmail?: string;
    senderName?: string;
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

    const checklistItems =
      data.daysUntil === 1
        ? [
            'Have your check-in code ready (see below)',
            'Plan your route and parking',
            'Charge your devices for networking',
            'Enjoy free breakfast and connect with fellow attendees',
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

    const checklistHtml = `<table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">${checklistItems
      .map(
        (item) =>
          `<tr><td style="padding:5px 0;font-size:13px;color:#555;">&#9679;&nbsp; ${item}</td></tr>`,
      )
      .join('')}</table>`;

    const checkInCodeHtml = data.checkInCode
      .split('')
      .map(
        (d) =>
          `<td style="width:48px;height:60px;background:${headerColor};color:#ffffff;font-family:'Courier New',monospace;font-size:26px;font-weight:700;text-align:center;border-radius:10px;">${d}</td>`,
      )
      .join('<td style="width:6px;"></td>');

    const locationHtml = data.eventLocation
      ? `<tr><td style="padding:7px 0;font-size:14px;color:#333;">&#128205;&nbsp; ${data.eventLocation}</td></tr>`
      : '';

    const { subject, html } = await this.templateResolver.resolveTemplate(
      'events.reminder',
      {
        firstName: data.firstName,
        eventTitle: data.eventTitle,
        formattedDate,
        formattedTime,
        reminderTitle,
        headerColor,
        headerSubtext,
        checklistHtml,
        checkInCodeHtml,
        locationHtml,
        daysText: data.daysUntil === 1 ? 'tomorrow' : `in ${data.daysUntil} days`,
        seeYouText: data.daysUntil === 1 ? 'tomorrow' : 'soon',
        year: String(new Date().getFullYear()),
      },
    );

    await this.emailProvider.sendEmail({
      to: data.email,
      subject,
      html,
      from: this.buildSenderFrom(
        data.senderEmail,
        data.senderName,
        data.eventTitle,
      ),
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
    const { subject, html } = await this.templateResolver.resolveTemplate(
      'first-timers.ready-for-integration',
      {
        firstTimerName: data.firstTimerName,
        markedBy: data.markedBy,
        markedAt: new Date(data.markedAt).toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        firstTimerId: data.firstTimerId,
        frontendUrl: this.frontendUrl,
      },
    );

    await this.emailProvider.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
    });
  }
}

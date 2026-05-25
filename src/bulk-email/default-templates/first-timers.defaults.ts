import { TemplateCategory, TemplateModule } from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
const color = '#7C3AED';

const wrapper = (content: string, topBar = true) =>
  `<div style="font-family: ${font}; background-color: #f4f4f5; padding: 32px 16px;">` +
  `<div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">` +
  (topBar ? `<div style="height: 4px; background: ${color};"></div>` : '') +
  `<div style="padding: 24px;">` +
  content +
  `</div>` +
  `</div>` +
  `</div>`;

const footer = (team = 'The Church Team') =>
  `<div style="border-top: 1px solid #f0f0f0; margin-top: 24px; padding-top: 16px; text-align: center;">` +
  `<p style="margin: 0; font-size: 12px; color: #9ca3af;">${team}</p>` +
  `</div>`;

const btn = (href: string, label: string, bg = color) =>
  `<div style="text-align: center; margin: 24px 0;">` +
  `<a href="${href}" style="display: inline-block; padding: 12px 28px; background: ${bg}; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">${label}</a>` +
  `</div>`;

const infoBox = (content: string) =>
  `<div style="background: #f8fafc; border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 16px 0;">` +
  content +
  `</div>`;

const warnBox = (content: string) =>
  `<div style="background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">` +
  content +
  `</div>`;

const h = (text: string) =>
  `<h2 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 16px; line-height: 1.3;">${text}</h2>`;

const p = (text: string) =>
  `<p style="font-size: 15px; color: #374151; line-height: 1.55; margin: 0 0 12px;">${text}</p>`;

const sub = (text: string) =>
  `<p style="font-size: 13px; color: #6b7280; line-height: 1.55; margin: 0 0 8px;">${text}</p>`;

const tableRow = (label: string, value: string) =>
  `<tr>` +
  `<td style="padding: 6px 8px; font-size: 13px; color: #6b7280;">${label}</td>` +
  `<td style="padding: 6px 8px; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${value}</td>` +
  `</tr>`;

const dataTable = (rows: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #eee; border-radius: 8px; margin: 16px 0;">` +
  rows +
  `</table>`;

export const firstTimersDefaults: TemplateDefinition[] = [
  {
    slug: 'first-timers.follow-up',
    name: 'First-Timer Follow Up',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.WELCOME,
    subject: 'We loved having you visit',
    htmlContent: wrapper(
      h('Thanks for Visiting!') +
      p('Dear {{firstName}} {{lastName}},') +
      p('We are so glad you joined us. We hope you felt welcome and at home during the service.') +
      infoBox(
        `<p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px;">What happens next</p>` +
        `<ul style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0; padding-left: 18px;">` +
        `<li>Our follow-up team will reach out soon</li>` +
        `<li>Reply to this email with any questions</li>` +
        `<li>We'd love to see you again next Sunday</li>` +
        `</ul>`
      ) +
      p('Looking forward to connecting with you!') +
      footer('The Follow-Up Team')
    ),
    variableDefinitions: [
      { name: 'firstName', description: 'First-timer first name', sampleValue: 'John' },
      { name: 'lastName', description: 'First-timer last name', sampleValue: 'Doe' },
    ],
  },
  {
    slug: 'first-timers.follow-up-reminder',
    name: 'Follow-Up Reminder',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.REMINDER,
    subject: 'Reminder: First-timers awaiting your follow-up',
    htmlContent: wrapper(
      h('Follow-Up Reminder') +
      p('Hi {{firstName}},') +
      p('You have first-timers assigned to you who still need follow-up. Timely outreach makes a real difference.') +
      warnBox(
        `<p style="font-size: 14px; font-weight: 600; color: #92400e; margin: 0 0 8px;">Pending follow-ups</p>` +
        `<div style="font-size: 14px; color: #78350f;">{{firstTimersList}}</div>`
      ) +
      sub('Please reach out as soon as you can.') +
      footer()
    ),
    variableDefinitions: [
      { name: 'firstName', description: 'Assigned person first name', sampleValue: 'John' },
      { name: 'firstTimersList', description: 'HTML list of first-timers (auto-generated)', sampleValue: '<ul><li>Jane Smith (08012345678) - 3 days since visit</li></ul>' },
    ],
  },
  {
    slug: 'first-timers.assignment',
    name: 'First-Timer Assignment',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.GENERAL,
    subject: 'New first-timer assignment from {{assignedBy}}',
    htmlContent: wrapper(
      h('First-Timer Assignment') +
      p('Hi {{assigneeName}},') +
      p('{{assignedBy}} has assigned you to follow up with the following first-timer(s):') +
      infoBox(`<div style="font-size: 14px; color: #374151;">{{firstTimersList}}</div>`) +
      infoBox(
        `<p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px;">Follow-up guidelines</p>` +
        `<ul style="font-size: 13px; color: #374151; line-height: 1.7; margin: 0; padding-left: 18px;">` +
        `<li>Contact within 24 - 48 hours</li>` +
        `<li>Complete 4 call reports per first-timer</li>` +
        `<li>Track attendance (2nd, 3rd, 4th services)</li>` +
        `<li>Update integration stage as they progress</li>` +
        `</ul>`
      ) +
      btn('{{frontendUrl}}/login', 'View Details') +
      p('Thank you for caring for our visitors!') +
      footer('The Leadership Team')
    ),
    variableDefinitions: [
      { name: 'assigneeName', description: 'Person assigned to follow up', sampleValue: 'John Doe' },
      { name: 'assignedBy', description: 'Person who made the assignment', sampleValue: 'Pastor Smith' },
      { name: 'firstTimersList', description: 'HTML list of assigned first-timers (auto-generated)', sampleValue: '<ul><li>Jane Smith - 08012345678</li></ul>' },
      { name: 'frontendUrl', description: 'Frontend URL', sampleValue: 'https://pptcrm.powerpointtribe.org' },
    ],
  },
  {
    slug: 'first-timers.thank-you',
    name: 'First-Timer Thank You',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.WELCOME,
    subject: 'Thank you for worshipping with us',
    htmlContent: wrapper(
      h('Thank You for Visiting!') +
      p('Dear {{firstName}} {{lastName}},') +
      p('It was wonderful having you worship with us. We hope you experienced the warmth of our community.') +
      infoBox(
        `<p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px;">We're here for you</p>` +
        `<ul style="font-size: 14px; color: #374151; line-height: 1.7; margin: 0; padding-left: 18px;">` +
        `<li>Our team will reach out to connect you</li>` +
        `<li>Learn about our ministries and activities</li>` +
        `<li>Feel free to reply with any questions</li>` +
        `</ul>`
      ) +
      p('We would love to see you again!') +
      footer('The Church Family')
    ),
    variableDefinitions: [
      { name: 'firstName', description: 'First-timer first name', sampleValue: 'John' },
      { name: 'lastName', description: 'First-timer last name', sampleValue: 'Doe' },
    ],
  },
  {
    slug: 'first-timers.conversion',
    name: 'Conversion Praise Report',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.GENERAL,
    subject: 'Praise Report: First-timer conversion',
    htmlContent: wrapper(
      h('Conversion Praise Report') +
      p('Dear {{giaLeaderName}},') +
      p('Great news — a first-timer has been successfully converted to a full member!') +
      dataTable(
        tableRow('First-Timer', '{{firstTimerName}}') +
        tableRow('New Member', '{{memberName}}') +
        tableRow('Conversion Date', '{{conversionDate}}')
      ) +
      p('Please continue to support and encourage them as they grow in faith.') +
      footer('The Leadership Team')
    ),
    variableDefinitions: [
      { name: 'giaLeaderName', description: 'GIA leader name', sampleValue: 'Pastor Smith' },
      { name: 'firstTimerName', description: 'First-timer name', sampleValue: 'John Doe' },
      { name: 'memberName', description: 'New member name', sampleValue: 'John Doe' },
      { name: 'conversionDate', description: 'Date of conversion', sampleValue: '2026-05-25' },
    ],
  },
  {
    slug: 'first-timers.ready-for-integration',
    name: 'Ready for Integration',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.GENERAL,
    subject: '{{firstTimerName}} is ready for integration',
    htmlContent: wrapper(
      h('Ready for Integration') +
      sub('A first-timer has been marked ready to become a member.') +
      `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">` +
      `<p style="font-size: 13px; font-weight: 600; color: #065f46; text-transform: uppercase; margin: 0 0 4px;">First-Timer</p>` +
      `<p style="font-size: 18px; font-weight: 700; color: #111827; margin: 0;">{{firstTimerName}}</p>` +
      `</div>` +
      dataTable(
        tableRow('Marked By', '{{markedBy}}') +
        tableRow('Date', '{{markedAt}}')
      ) +
      btn('{{frontendUrl}}/first-timers/{{firstTimerId}}', 'View Profile', '#10b981') +
      footer()
    ),
    variableDefinitions: [
      { name: 'firstTimerName', description: 'First-timer full name', sampleValue: 'John Doe' },
      { name: 'markedBy', description: 'Person who marked as ready', sampleValue: 'Pastor Smith' },
      { name: 'markedAt', description: 'Date marked', sampleValue: '25 May, 2026' },
      { name: 'firstTimerId', description: 'First-timer ID', sampleValue: '12345' },
      { name: 'frontendUrl', description: 'Frontend URL', sampleValue: 'https://pptcrm.powerpointtribe.org' },
    ],
  },
  {
    slug: 'first-timers.unit-leader-notification',
    name: 'Unit Leader Alert',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.REMINDER,
    subject: 'Action needed: Pre-filled messages missing',
    htmlContent: wrapper(
      h('Pre-filled Message Required') +
      p('Hi {{leaderName}},') +
      p('The following first-timer(s) do not have a pre-filled message set. Please log in and update them.') +
      warnBox(
        `<p style="font-size: 14px; font-weight: 600; color: #92400e; margin: 0 0 8px;">Needs attention</p>` +
        `<div style="font-size: 14px; color: #78350f;">{{firstTimersList}}</div>`
      ) +
      footer()
    ),
    variableDefinitions: [
      { name: 'leaderName', description: 'Unit leader name', sampleValue: 'John Doe' },
      { name: 'firstTimersList', description: 'HTML list of first-timers (auto-generated)', sampleValue: '<ul><li>Jane Smith - Visited: 2026-05-20</li></ul>' },
    ],
  },
  {
    slug: 'first-timers.follow-up-task',
    name: 'Follow-Up Task Notification',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.REMINDER,
    subject: 'Follow-up task: {{firstTimerName}} — {{urgency}} priority',
    htmlContent: wrapper(
      h('Follow-Up Task') +
      p('Hi {{assignedPersonName}},') +
      p('You have a follow-up task that needs attention:') +
      `<div style="background: #f8fafc; border: 1px solid #eee; border-left: 3px solid {{urgencyColor}}; border-radius: 8px; padding: 16px; margin: 16px 0;">` +
      dataTable(
        tableRow('First-Timer', '{{firstTimerName}}') +
        tableRow('Task Type', '{{taskType}}') +
        tableRow('Priority', '{{urgencyMessage}}')
      ) +
      `<div style="font-size: 13px; color: #374151; margin-top: 8px;">{{daysOverdueHtml}}</div>` +
      `</div>` +
      sub('Please log in to complete this task.') +
      footer()
    ),
    variableDefinitions: [
      { name: 'assignedPersonName', description: 'Assigned person name', sampleValue: 'John Doe' },
      { name: 'firstTimerName', description: 'First-timer name', sampleValue: 'Jane Smith' },
      { name: 'taskType', description: 'Type of follow-up task', sampleValue: 'Phone Call' },
      { name: 'urgency', description: 'Priority level (LOW/MEDIUM/HIGH)', sampleValue: 'HIGH' },
      { name: 'urgencyColor', description: 'Color for urgency level', sampleValue: '#dc3545' },
      { name: 'urgencyMessage', description: 'Urgency description', sampleValue: 'Urgent follow-up required' },
      { name: 'daysOverdueHtml', description: 'Days overdue HTML (auto-generated)', sampleValue: '<p><strong>Days Overdue:</strong> 5</p>' },
    ],
  },
  {
    slug: 'first-timers.bulk-assignment',
    name: 'Bulk Assignment Notification',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.GENERAL,
    subject: 'New assignments from {{assignedBy}}',
    htmlContent: wrapper(
      h('New Assignments') +
      p('Hi {{assigneeName}},') +
      p('{{assignedBy}} has assigned you multiple first-timers:') +
      infoBox(`<div style="font-size: 14px; color: #374151;">{{assignmentsList}}</div>`) +
      sub('Please log in to review and begin your follow-ups.') +
      footer('The Leadership Team')
    ),
    variableDefinitions: [
      { name: 'assigneeName', description: 'Assigned person name', sampleValue: 'John Doe' },
      { name: 'assignedBy', description: 'Person who made the assignment', sampleValue: 'Pastor Smith' },
      { name: 'assignmentsList', description: 'HTML list of assignments (auto-generated)', sampleValue: '<ul><li>Jane Smith (first timer)</li></ul>' },
    ],
  },
  {
    slug: 'first-timers.scheduled-reminder',
    name: 'Scheduled Follow-Up Reminder',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.REMINDER,
    subject: 'Scheduled reminder: Follow up with {{firstTimerName}}',
    htmlContent: wrapper(
      h('Scheduled Follow-Up') +
      sub('Scheduled for {{scheduledTime}}') +
      p('Hi {{assignedPersonName}},') +
      p('This is your reminder to follow up with the person below.') +
      `<div style="background: #f8fafc; border: 1px solid #eee; border-left: 3px solid ${color}; border-radius: 8px; padding: 16px; margin: 16px 0;">` +
      `<p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 8px;">{{firstTimerName}}</p>` +
      `<p style="font-size: 13px; color: #374151; margin: 0 0 4px;">Phone: {{firstTimerPhone}}</p>` +
      `{{firstTimerEmailHtml}}` +
      `{{followUpNotesHtml}}` +
      `</div>` +
      sub('Please reach out as soon as possible.') +
      footer()
    ),
    variableDefinitions: [
      { name: 'assignedPersonName', description: 'Assigned person name', sampleValue: 'John Doe' },
      { name: 'firstTimerName', description: 'First-timer name', sampleValue: 'Jane Smith' },
      { name: 'firstTimerPhone', description: 'First-timer phone', sampleValue: '08012345678' },
      { name: 'scheduledTime', description: 'Scheduled time', sampleValue: '2:00 PM' },
      { name: 'firstTimerEmailHtml', description: 'Email line HTML (auto-generated)', sampleValue: '' },
      { name: 'followUpNotesHtml', description: 'Notes HTML (auto-generated)', sampleValue: '' },
    ],
  },
  {
    slug: 'first-timers.member-followup-assignment',
    name: 'Member Follow-Up Assignment',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.GENERAL,
    subject: '{{titleType}}: {{count}} first-timer(s) assigned to you',
    htmlContent:
      `<div style="font-family: ${font}; background-color: #f4f4f5; padding: 32px 16px;">` +
      `<div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">` +
      // --- nicer header for main assignment template ---
      `<div style="background: linear-gradient(135deg, ${color} 0%, #5b21b6 100%); padding: 28px 24px; text-align: center;">` +
      `<h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 4px;">New First-Timer {{titleType}}</h1>` +
      `<p style="font-size: 13px; color: rgba(255,255,255,0.85); margin: 0;">{{count}} first-timer(s) assigned by {{assignedBy}}</p>` +
      `</div>` +
      // --- body ---
      `<div style="padding: 24px;">` +
      p('Hi {{memberName}},') +
      p('You have been <strong>{{actionType}}</strong> the following first-timer(s):') +
      infoBox(
        `<p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px;">Assigned first-timers</p>` +
        `<div style="font-size: 14px; color: #374151;">{{firstTimersList}}</div>`
      ) +
      infoBox(
        `<p style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 8px;">{{titleType}} guidelines</p>` +
        `<ul style="font-size: 13px; color: #374151; line-height: 1.8; margin: 0; padding-left: 18px;">` +
        `<li>Contact within 24 - 48 hours</li>` +
        `<li>Complete 4 call reports per first-timer</li>` +
        `<li>Track service attendance (2nd, 3rd, 4th services)</li>` +
        `<li>Update integration stages as they progress</li>` +
        `<li>Show genuine care and follow through</li>` +
        `</ul>`
      ) +
      btn('{{frontendUrl}}/login', 'View Details') +
      p('Thank you for your commitment to our visitors!') +
      footer('The Leadership Team') +
      `</div>` +
      `</div>` +
      `</div>`,
    variableDefinitions: [
      { name: 'memberName', description: 'Assigned member name', sampleValue: 'John Doe' },
      { name: 'assignedBy', description: 'Person who assigned', sampleValue: 'Pastor Smith' },
      { name: 'titleType', description: 'Assignment or Follow-Up', sampleValue: 'Assignment' },
      { name: 'actionType', description: 'assigned to or follow up with', sampleValue: 'assigned to' },
      { name: 'count', description: 'Number of first-timers', sampleValue: '2' },
      { name: 'firstTimersList', description: 'HTML list of first-timers (auto-generated)', sampleValue: '<ul><li>Jane Smith - 08012345678</li></ul>' },
      { name: 'frontendUrl', description: 'Frontend URL', sampleValue: 'https://pptcrm.powerpointtribe.org' },
    ],
  },
];

import { TemplateCategory, TemplateModule } from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

const wrapper = (content: string, topColor = '#2563EB') => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:${font};">
<div style="max-width:560px; margin:32px auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
<div style="height:4px; background:${topColor};"></div>
<div style="padding:24px;">
${content}
</div>
</div>
<div style="text-align:center; padding:16px; font-size:12px; color:#9ca3af;">Church Management System</div>
</body></html>`;

const birthdayWrapper = (content: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:${font};">
<div style="max-width:560px; margin:32px auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
<div style="background:linear-gradient(135deg, #2563EB 0%, #7c3aed 100%); padding:32px 24px; text-align:center;">
<div style="font-size:36px; line-height:1;">&#127882;</div>
<h1 style="color:#ffffff; margin:12px 0 0; font-size:22px; font-weight:600;">Happy Birthday!</h1>
</div>
<div style="padding:24px;">
${content}
</div>
</div>
<div style="text-align:center; padding:16px; font-size:12px; color:#9ca3af;">Church Management System</div>
</body></html>`;

export const membersDefaults: TemplateDefinition[] = [
  {
    slug: 'members.welcome',
    name: 'Member Welcome Email',
    module: TemplateModule.MEMBERS,
    category: TemplateCategory.WELCOME,
    subject: 'Welcome to the Family, {{firstName}}!',
    htmlContent: wrapper(`
<h2 style="margin:0 0 16px; font-size:20px; color:#111827; font-weight:600;">Welcome, {{firstName}}!</h2>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px;">We're glad you've joined our church family. Our follow-up team will reach out soon to help you get connected.</p>
<div style="background:#f8fafc; border:1px solid #eee; border-radius:8px; padding:16px; margin:0 0 20px;">
  <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#111827;">What to expect</p>
  <table style="width:100%; font-size:13px; color:#4b5563; line-height:1.55;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:3px 8px 3px 0; vertical-align:top; color:#9ca3af;">&bull;</td><td style="padding:3px 0;">Contact from our follow-up team within 48 hours</td></tr>
    <tr><td style="padding:3px 8px 3px 0; vertical-align:top; color:#9ca3af;">&bull;</td><td style="padding:3px 0;">An invitation to join a district near you</td></tr>
    <tr><td style="padding:3px 8px 3px 0; vertical-align:top; color:#9ca3af;">&bull;</td><td style="padding:3px 0;">Details about our new members class</td></tr>
  </table>
</div>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0;">Blessings,<br/><span style="color:#6b7280;">The Church Leadership Team</span></p>
`),
    variableDefinitions: [
      { name: 'firstName', description: 'Member first name', sampleValue: 'John' },
      { name: 'lastName', description: 'Member last name', sampleValue: 'Doe' },
    ],
  },
  {
    slug: 'members.birthday-wishes',
    name: 'Birthday Wishes',
    module: TemplateModule.MEMBERS,
    category: TemplateCategory.GENERAL,
    subject: 'Happy Birthday, {{firstName}}! 🎉',
    htmlContent: birthdayWrapper(`
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px; text-align:center;">Dear <strong>{{firstName}}</strong>,</p>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px; text-align:center;">We're so blessed to have you in our church family. May God's grace and favour surround you today and in the year ahead.</p>
<div style="text-align:center; margin:20px 0;">
  <span style="font-size:32px;">&#127874; &#127881; &#127873;</span>
</div>
<p style="font-size:13px; line-height:1.55; color:#6b7280; margin:0; text-align:center;">With love and prayers,<br/><strong style="color:#374151;">Your Church Family</strong></p>
`),
    variableDefinitions: [
      { name: 'firstName', description: 'Member first name', sampleValue: 'John' },
    ],
  },
  {
    slug: 'members.pre-birthday-notification',
    name: 'Pre-Birthday Team Notification',
    module: TemplateModule.MEMBERS,
    category: TemplateCategory.REMINDER,
    subject: 'Upcoming Birthdays: {{memberCount}} member(s) in 3 days',
    htmlContent: wrapper(`
<h2 style="margin:0 0 4px; font-size:20px; color:#111827; font-weight:600;">Upcoming Birthdays</h2>
<p style="font-size:13px; color:#6b7280; margin:0 0 16px;">{{formattedDate}} &mdash; 3 days away</p>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px;">Hi {{recipientName}}, the following member(s) have a birthday in <strong>3 days</strong>:</p>
<div style="margin:0 0 16px;">{{birthdayListHtml}}</div>
<div style="background:#f8fafc; border:1px solid #eee; border-radius:8px; padding:16px; margin:0 0 20px;">
  <p style="margin:0; font-size:13px; color:#4b5563; line-height:1.55;"><strong>Tip:</strong> Consider reaching out or organising a celebration.</p>
</div>
<div style="text-align:center; margin:0 0 4px;">
  <a href="{{frontendUrl}}/members?tab=birthdays" style="display:inline-block; background:#2563EB; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:8px; font-size:14px; font-weight:500;">View Birthdays</a>
</div>
`),
    variableDefinitions: [
      { name: 'recipientName', description: 'Recipient name', sampleValue: 'Admin' },
      { name: 'formattedDate', description: 'Birthday date', sampleValue: 'Friday, May 30' },
      { name: 'birthdayListHtml', description: 'HTML table of upcoming birthdays (auto-generated)', sampleValue: '<p>John Doe, Jane Smith</p>' },
      { name: 'memberCount', description: 'Number of members with birthdays', sampleValue: '3' },
      { name: 'frontendUrl', description: 'Frontend URL', sampleValue: 'https://pptcrm.powerpointtribe.org' },
    ],
  },
  {
    slug: 'members.birthday-day-notification',
    name: 'Birthday Day Team Notification',
    module: TemplateModule.MEMBERS,
    category: TemplateCategory.REMINDER,
    subject: "Today's Birthdays: {{memberCount}} member(s) celebrating",
    htmlContent: wrapper(`
<h2 style="margin:0 0 4px; font-size:20px; color:#111827; font-weight:600;">Today's Birthdays</h2>
<p style="font-size:13px; color:#6b7280; margin:0 0 16px;">{{todayDate}}</p>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px;">Hi {{recipientName}}, the following member(s) are celebrating <strong>today</strong>:</p>
<div style="margin:0 0 16px;">{{birthdayListHtml}}</div>
<div style="background:#f8fafc; border:1px solid #eee; border-radius:8px; padding:16px; margin:0 0 20px;">
  <p style="margin:0; font-size:13px; color:#4b5563; line-height:1.55;"><strong>Action:</strong> A personal call or message can make their day special.</p>
</div>
<div style="text-align:center; margin:0 0 4px;">
  <a href="{{frontendUrl}}/members?tab=birthdays" style="display:inline-block; background:#2563EB; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:8px; font-size:14px; font-weight:500;">View Birthdays</a>
</div>
`),
    variableDefinitions: [
      { name: 'recipientName', description: 'Recipient name', sampleValue: 'Admin' },
      { name: 'todayDate', description: "Today's formatted date", sampleValue: 'Sunday, May 25, 2026' },
      { name: 'birthdayListHtml', description: 'HTML table of birthdays (auto-generated)', sampleValue: '<p>John Doe, Jane Smith</p>' },
      { name: 'memberCount', description: 'Number of members with birthdays', sampleValue: '2' },
      { name: 'frontendUrl', description: 'Frontend URL', sampleValue: 'https://pptcrm.powerpointtribe.org' },
    ],
  },
  {
    slug: 'members.creation-notification',
    name: 'Member Created Notification',
    module: TemplateModule.MEMBERS,
    category: TemplateCategory.GENERAL,
    subject: 'New Member Created: {{memberName}}',
    htmlContent: wrapper(`
<h2 style="margin:0 0 16px; font-size:20px; color:#111827; font-weight:600;">Member Record Created</h2>
<p style="font-size:15px; line-height:1.55; color:#374151; margin:0 0 16px;">Hi {{adminName}}, a new member has been created from a first-timer conversion.</p>
<div style="background:#f8fafc; border:1px solid #eee; border-radius:8px; padding:16px; margin:0 0 20px;">
  <table style="width:100%; border-collapse:collapse; font-size:14px;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:6px 12px 6px 0; color:#6b7280; white-space:nowrap; vertical-align:top;">Name</td>
      <td style="padding:6px 0; color:#111827; font-weight:500;">{{memberName}}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0; color:#6b7280; white-space:nowrap; vertical-align:top;">Email</td>
      <td style="padding:6px 0; color:#111827;">{{memberEmail}}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0; color:#6b7280; white-space:nowrap; vertical-align:top;">First-Timer ID</td>
      <td style="padding:6px 0; color:#111827;">{{firstTimerId}}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px 6px 0; color:#6b7280; white-space:nowrap; vertical-align:top;">Converted</td>
      <td style="padding:6px 0; color:#111827;">{{conversionDate}}</td>
    </tr>
  </table>
</div>
<p style="font-size:13px; line-height:1.55; color:#6b7280; margin:0;">The original first-timer record has been updated to reflect this conversion.</p>
`),
    variableDefinitions: [
      { name: 'adminName', description: 'Admin name', sampleValue: 'Admin' },
      { name: 'memberName', description: 'New member full name', sampleValue: 'John Doe' },
      { name: 'memberEmail', description: 'New member email', sampleValue: 'john@example.com' },
      { name: 'firstTimerId', description: 'Original first-timer ID', sampleValue: '12345' },
      { name: 'conversionDate', description: 'Date of conversion', sampleValue: '2026-05-25' },
    ],
  },
];

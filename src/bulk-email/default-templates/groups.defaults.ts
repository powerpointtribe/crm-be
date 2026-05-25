import { TemplateCategory, TemplateModule } from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

export const groupsDefaults: TemplateDefinition[] = [
  {
    slug: 'groups.meeting-reminder',
    name: 'District Meeting Reminder',
    module: TemplateModule.GROUPS,
    category: TemplateCategory.REMINDER,
    subject: '📍 {{districtName}} — Meeting Reminder',
    htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="height: 4px; background: #059669;"></div>
    <div style="padding: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">District Meeting Reminder</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px 0; color: #374151;">Hi {{name}}, here's a reminder about our upcoming meeting.</p>
      <div style="background: #f0fdf4; border-left: 3px solid #059669; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">District</td>
            <td style="padding: 4px 0;">{{districtName}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Date & Time</td>
            <td style="padding: 4px 0;">{{meetingDateTime}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Location</td>
            <td style="padding: 4px 0;">{{location}}</td>
          </tr>
        </table>
        {{hostHtml}}
      </div>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 4px 0; color: #374151;">Looking forward to seeing you there!</p>
      <p style="font-size: 15px; line-height: 1.55; margin: 0; color: #374151;">Blessings,<br/>Your District Leadership</p>
    </div>
    <div style="padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">You're receiving this because you're a member of {{districtName}}.</p>
    </div>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'name', description: 'Recipient name', sampleValue: 'John' },
      { name: 'districtName', description: 'District name', sampleValue: 'Lekki District' },
      { name: 'meetingDateTime', description: 'Meeting date and time', sampleValue: 'Saturday, May 25 at 5:00 PM' },
      { name: 'location', description: 'Meeting location', sampleValue: '10 Admiralty Way, Lekki' },
      { name: 'hostHtml', description: 'Host info HTML (auto-generated, optional)', sampleValue: '<p><strong>Host:</strong> Brother James</p>' },
    ],
  },
  {
    slug: 'groups.leadership-assignment',
    name: 'Leadership Assignment',
    module: TemplateModule.GROUPS,
    category: TemplateCategory.GENERAL,
    subject: 'You\'ve been assigned as {{role}} — {{groupName}}',
    htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="height: 4px; background: #059669;"></div>
    <div style="padding: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">Leadership Assignment</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px 0; color: #374151;">Dear {{firstName}} {{lastName}}, you've been assigned a new leadership role.</p>
      <div style="background: #f0fdf4; border-left: 3px solid #059669; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Position</td>
            <td style="padding: 4px 0;">{{role}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Group</td>
            <td style="padding: 4px 0;">{{groupName}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 12px 4px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Assigned by</td>
            <td style="padding: 4px 0;">{{assignedBy}}</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 4px 0; color: #374151;">Congratulations — this is a meaningful opportunity to serve and impact lives.</p>
      <p style="font-size: 15px; line-height: 1.55; margin: 0; color: #374151;">God bless,<br/>The Leadership Team</p>
    </div>
    <div style="padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated leadership notification.</p>
    </div>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'firstName', description: 'Leader first name', sampleValue: 'John' },
      { name: 'lastName', description: 'Leader last name', sampleValue: 'Doe' },
      { name: 'role', description: 'Leadership role', sampleValue: 'District Pastor' },
      { name: 'groupName', description: 'Group name', sampleValue: 'Lekki District' },
      { name: 'assignedBy', description: 'Assigned by', sampleValue: 'Pastor Smith' },
    ],
  },
  {
    slug: 'groups.district-pastor-notification',
    name: 'District Pastor Notification',
    module: TemplateModule.GROUPS,
    category: TemplateCategory.GENERAL,
    subject: 'New members assigned to {{districtName}}',
    htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="height: 4px; background: #059669;"></div>
    <div style="padding: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">New Members Assigned</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px 0; color: #374151;">Dear Pastor {{pastorName}}, new members have been added to <strong>{{districtName}}</strong>.</p>
      <div style="background: #f0fdf4; border-left: 3px solid #059669; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        {{membersList}}
      </div>
      <div style="background: #f8fafc; border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
        <p style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #111827;">Next Steps</p>
        <ul style="font-size: 13px; line-height: 1.7; margin: 0; padding-left: 18px; color: #374151;">
          <li>Welcome them to the district</li>
          <li>Invite them to upcoming activities</li>
          <li>Help them connect with other members</li>
        </ul>
      </div>
      <p style="font-size: 15px; line-height: 1.55; margin: 0; color: #374151;">Thank you for your leadership,<br/>The Leadership Team</p>
    </div>
    <div style="padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">This is an automated notification for district pastors.</p>
    </div>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'pastorName', description: 'District pastor name', sampleValue: 'Pastor Smith' },
      { name: 'districtName', description: 'District name', sampleValue: 'Lekki District' },
      { name: 'membersList', description: 'HTML list of new members (auto-generated)', sampleValue: '<ul><li>John Doe - 08012345678</li></ul>' },
    ],
  },
  {
    slug: 'groups.weekly-meeting-reminder',
    name: 'Weekly Meeting Reminder',
    module: TemplateModule.GROUPS,
    category: TemplateCategory.REMINDER,
    subject: 'Weekly meeting reminder',
    htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="height: 4px; background: #059669;"></div>
    <div style="padding: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">Weekly Meeting Reminder</h1>
      <p style="font-size: 15px; line-height: 1.55; margin: 0 0 16px 0; color: #374151;">Hi {{firstName}} {{lastName}}, here's a reminder about our upcoming weekly meeting.</p>
      {{meetingDetailsHtml}}
      <p style="font-size: 15px; line-height: 1.55; margin: 16px 0 4px 0; color: #374151;">We'd love to see you there!</p>
      <p style="font-size: 15px; line-height: 1.55; margin: 0; color: #374151;">Blessings,<br/>The Church Team</p>
    </div>
    <div style="padding: 16px 24px; text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">You're receiving this as a weekly meeting reminder.</p>
    </div>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'firstName', description: 'Recipient first name', sampleValue: 'John' },
      { name: 'lastName', description: 'Recipient last name', sampleValue: 'Doe' },
      { name: 'meetingDetailsHtml', description: 'Meeting details HTML (auto-generated)', sampleValue: '<div style="background: #f8f9fa; padding: 20px; border-radius: 8px;"><p><strong>Date:</strong> Saturday</p></div>' },
    ],
  },
];

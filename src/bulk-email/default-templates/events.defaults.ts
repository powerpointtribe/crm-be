import { TemplateCategory, TemplateModule } from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

export const eventsDefaults: TemplateDefinition[] = [
  {
    slug: 'events.registration-confirmation',
    name: 'Event Registration Confirmation',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: "You're registered - {{eventTitle}}",
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:#0D7770;padding:36px 24px 32px;text-align:center;">
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;font-size:24px;margin-bottom:14px;">&#10003;</div>
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">You're In!</h1>
    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">{{eventTitle}}</p>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;font-weight:500;">Hi {{firstName}},</p>
    <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.55;">Your registration for <strong style="color:#1a1a1a;">{{eventTitle}}</strong> is confirmed. Here's everything you need.</p>
    <div style="background:#f8fafc;border:1px solid #eee;border-radius:8px;padding:24px 20px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#0D7770;">Your Check-In Code</p>
      <table style="margin:14px auto 10px;border-spacing:0;" cellpadding="0" cellspacing="0"><tr>{{checkInCodeHtml}}</tr></table>
      <p style="margin:0;font-size:12px;color:#888;">Show this code at the door for instant check-in</p>
    </div>
    <div style="border-radius:8px;overflow:hidden;margin:0 0 24px;border:1px solid #eee;">
      <div style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Event Details</p>
      </div>
      <div style="padding:14px 20px;">
        <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:7px 0;color:#0D7770;font-size:14px;width:24px;">&#128197;</td><td style="padding:7px 0;font-size:14px;color:#333;">{{formattedDate}}</td></tr>
          <tr><td style="padding:7px 0;color:#0D7770;font-size:14px;width:24px;">&#128336;</td><td style="padding:7px 0;font-size:14px;color:#333;">{{formattedTime}}</td></tr>
          {{locationHtml}}
          {{trackHtml}}
        </table>
      </div>
    </div>
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1a1a1a;">Before the event:</p>
      <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
        <tr><td style="padding:5px 0;font-size:13px;color:#555;">&#9679;&nbsp; Screenshot this email or save your check-in code</td></tr>
        <tr><td style="padding:5px 0;font-size:13px;color:#555;">&#9679;&nbsp; Arrive 15 minutes early for networking</td></tr>
        <tr><td style="padding:5px 0;font-size:13px;color:#555;">&#9679;&nbsp; Enjoy free breakfast and connect with fellow attendees</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:24px 0 0;"><p style="margin:0;font-size:13px;color:#555;">See you there!</p></div>
  </div>
  <div style="padding:20px 24px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Church Management System</p>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'firstName', description: 'Attendee first name', sampleValue: 'John' },
      { name: 'eventTitle', description: 'Event title', sampleValue: 'LBS Conference 2026' },
      { name: 'checkInCodeHtml', description: 'Check-in code digits HTML (auto-generated)', sampleValue: '<td style="background:#0D7770;color:#fff;font-size:28px;width:52px;height:64px;text-align:center;border-radius:10px;">1</td>' },
      { name: 'formattedDate', description: 'Formatted event date', sampleValue: 'Saturday, May 30, 2026' },
      { name: 'formattedTime', description: 'Formatted event time', sampleValue: '10:00 AM' },
      { name: 'locationHtml', description: 'Location row HTML (auto-generated, optional)', sampleValue: '' },
      { name: 'trackHtml', description: 'Track row HTML (auto-generated, optional)', sampleValue: '' },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.reminder',
    name: 'Event Reminder',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.REMINDER,
    subject: '{{eventTitle}} - {{reminderTitle}}',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:{{headerColor}};padding:36px 24px 32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:40px;font-weight:700;color:#ffffff;letter-spacing:-1px;">{{reminderTitle}}</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">{{headerSubtext}}</p>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 8px;font-weight:500;">Hi {{firstName}},</p>
    <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.55;"><strong style="color:#1a1a1a;">{{eventTitle}}</strong> is {{daysText}}. Here's a quick refresher.</p>
    <div style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:0 0 20px;">
      <div style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Event Details</p>
      </div>
      <div style="padding:14px 20px;">
        <table style="width:100%;border-spacing:0;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:7px 0;font-size:14px;color:#333;">&#128197;&nbsp; {{formattedDate}}</td></tr>
          <tr><td style="padding:7px 0;font-size:14px;color:#333;">&#128336;&nbsp; {{formattedTime}}</td></tr>
          {{locationHtml}}
        </table>
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:{{headerColor}};">Your Check-In Code</p>
      <table style="margin:14px auto 10px;border-spacing:0;" cellpadding="0" cellspacing="0"><tr>{{checkInCodeHtml}}</tr></table>
      <p style="margin:0;font-size:12px;color:#888;">Show this at the door for instant check-in</p>
    </div>
    <div style="margin:0 0 20px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1a1a1a;">Preparation checklist:</p>
      {{checklistHtml}}
    </div>
    <div style="text-align:center;margin:24px 0 0;"><p style="margin:0;font-size:13px;color:#555;">See you {{seeYouText}}!</p></div>
  </div>
  <div style="padding:20px 24px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Church Management System</p>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'firstName', description: 'Attendee first name', sampleValue: 'John' },
      { name: 'eventTitle', description: 'Event title', sampleValue: 'LBS Conference 2026' },
      { name: 'reminderTitle', description: 'Reminder title (e.g., Tomorrow, 3 Days Left)', sampleValue: 'Tomorrow' },
      { name: 'headerSubtext', description: 'Header subtext', sampleValue: 'Final check before the big day' },
      { name: 'headerColor', description: 'Header background color', sampleValue: '#B91C1C' },
      { name: 'daysText', description: 'Days description', sampleValue: 'tomorrow' },
      { name: 'formattedDate', description: 'Formatted event date', sampleValue: 'Saturday, May 30, 2026' },
      { name: 'formattedTime', description: 'Formatted event time', sampleValue: '10:00 AM' },
      { name: 'locationHtml', description: 'Location HTML (auto-generated)', sampleValue: '' },
      { name: 'checkInCodeHtml', description: 'Check-in code HTML (auto-generated)', sampleValue: '' },
      { name: 'checklistHtml', description: 'Checklist HTML (auto-generated)', sampleValue: '' },
      { name: 'seeYouText', description: 'See you text (tomorrow/soon)', sampleValue: 'tomorrow' },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.partner-inquiry-confirmation',
    name: 'Partner Inquiry Confirmation',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: 'Partnership Inquiry Received - {{eventTitle}}',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:#1E40AF;padding:36px 24px 32px;text-align:center;">
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Inquiry Received</h1>
    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">{{eventTitle}} Partnership</p>
  </div>
  <div style="padding:24px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;font-weight:500;">Hi {{name}},</p>
    <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.55;">Thank you for your interest in partnering with us for <strong>{{eventTitle}}</strong>. We've received your inquiry{{companyText}} and are excited to explore this with you.</p>
    <div style="margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">What happens next</p>
      <p style="font-size:15px;color:#555;line-height:1.55;">1. Our partnerships team will review your inquiry within 24-48 hours.<br/>2. We'll reach out to discuss opportunities.<br/>3. You'll receive details on available partnership tiers and benefits.</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #eee;border-radius:8px;padding:14px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#555;">Need to speak with us sooner? Reach out at <a href="mailto:partnerships@powerpointtribe.org" style="color:#1E40AF;text-decoration:none;font-weight:600;">partnerships@powerpointtribe.org</a></p>
    </div>
    <p style="margin:0;font-size:15px;color:#555;">We look forward to working together.</p>
  </div>
  <div style="padding:20px 24px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Church Management System</p>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'name', description: 'Partner name', sampleValue: 'John Doe' },
      { name: 'eventTitle', description: 'Event title', sampleValue: 'LBS Conference 2026' },
      { name: 'companyText', description: 'Company text (auto-generated, optional)', sampleValue: ' on behalf of Acme Corp' },
    ],
  },
  {
    slug: 'events.partner-inquiry-admin',
    name: 'Partner Inquiry Admin Alert',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: 'New Partnership Inquiry - {{partnerName}}{{companyText}}',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:#B91C1C;padding:36px 24px 32px;text-align:center;">
    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">New Partnership Inquiry</h1>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">{{eventTitle}}</p>
  </div>
  <div style="padding:24px;">
    <div style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin:0 0 20px;">
      <div style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Partner Information</p>
      </div>
      <div style="padding:14px 20px;">
        <table style="width:100%;border-spacing:0;">
          <tr><td style="padding:7px 0;font-size:12px;color:#999;width:80px;">Name</td><td style="padding:7px 0;font-size:14px;color:#1a1a1a;font-weight:500;">{{partnerName}}</td></tr>
          {{partnerCompanyHtml}}
          <tr><td style="padding:7px 0;font-size:12px;color:#999;">Email</td><td style="padding:7px 0;font-size:14px;"><a href="mailto:{{partnerEmail}}" style="color:#1E40AF;text-decoration:none;">{{partnerEmail}}</a></td></tr>
          {{partnerPhoneHtml}}
        </table>
      </div>
    </div>
    {{interestDetailsHtml}}
    <div style="text-align:center;margin:24px 0;">
      <a href="{{viewUrl}}" style="display:inline-block;background:#1E40AF;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in Dashboard</a>
    </div>
    <div style="background:#f8fafc;border:1px solid #eee;border-radius:8px;padding:14px 20px;">
      <p style="margin:0;font-size:13px;color:#2e7d32;">Respond within 24-48 hours to maintain partner interest.</p>
    </div>
  </div>
  <div style="padding:20px 24px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Church Management System</p>
  </div>
</div>`,
    variableDefinitions: [
      { name: 'partnerName', description: 'Partner name', sampleValue: 'John Doe' },
      { name: 'partnerEmail', description: 'Partner email', sampleValue: 'john@acme.com' },
      { name: 'eventTitle', description: 'Event title', sampleValue: 'LBS Conference 2026' },
      { name: 'companyText', description: 'Company text (auto-generated)', sampleValue: ' (Acme Corp)' },
      { name: 'partnerCompanyHtml', description: 'Company row HTML (auto-generated)', sampleValue: '' },
      { name: 'partnerPhoneHtml', description: 'Phone row HTML (auto-generated)', sampleValue: '' },
      { name: 'interestDetailsHtml', description: 'Interest details HTML (auto-generated)', sampleValue: '' },
      { name: 'viewUrl', description: 'Dashboard URL to view inquiry', sampleValue: 'https://pptcrm.powerpointtribe.org/events/partners?id=123' },
    ],
  },
];

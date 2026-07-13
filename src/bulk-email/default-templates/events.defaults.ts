import {
  TemplateCategory,
  TemplateModule,
} from '../schemas/email-template.schema';
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
      {
        name: 'firstName',
        description: 'Attendee first name',
        sampleValue: 'John',
      },
      {
        name: 'eventTitle',
        description: 'Event title',
        sampleValue: 'LBS Conference 2026',
      },
      {
        name: 'checkInCodeHtml',
        description: 'Check-in code digits HTML (auto-generated)',
        sampleValue:
          '<td style="background:#0D7770;color:#fff;font-size:28px;width:52px;height:64px;text-align:center;border-radius:10px;">1</td>',
      },
      {
        name: 'formattedDate',
        description: 'Formatted event date',
        sampleValue: 'Saturday, May 30, 2026',
      },
      {
        name: 'formattedTime',
        description: 'Formatted event time',
        sampleValue: '10:00 AM',
      },
      {
        name: 'locationHtml',
        description: 'Location row HTML (auto-generated, optional)',
        sampleValue: '',
      },
      {
        name: 'trackHtml',
        description: 'Track row HTML (auto-generated, optional)',
        sampleValue: '',
      },
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
      {
        name: 'firstName',
        description: 'Attendee first name',
        sampleValue: 'John',
      },
      {
        name: 'eventTitle',
        description: 'Event title',
        sampleValue: 'LBS Conference 2026',
      },
      {
        name: 'reminderTitle',
        description: 'Reminder title (e.g., Tomorrow, 3 Days Left)',
        sampleValue: 'Tomorrow',
      },
      {
        name: 'headerSubtext',
        description: 'Header subtext',
        sampleValue: 'Final check before the big day',
      },
      {
        name: 'headerColor',
        description: 'Header background color',
        sampleValue: '#B91C1C',
      },
      {
        name: 'daysText',
        description: 'Days description',
        sampleValue: 'tomorrow',
      },
      {
        name: 'formattedDate',
        description: 'Formatted event date',
        sampleValue: 'Saturday, May 30, 2026',
      },
      {
        name: 'formattedTime',
        description: 'Formatted event time',
        sampleValue: '10:00 AM',
      },
      {
        name: 'locationHtml',
        description: 'Location HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'checkInCodeHtml',
        description: 'Check-in code HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'checklistHtml',
        description: 'Checklist HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'seeYouText',
        description: 'See you text (tomorrow/soon)',
        sampleValue: 'tomorrow',
      },
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
      {
        name: 'eventTitle',
        description: 'Event title',
        sampleValue: 'LBS Conference 2026',
      },
      {
        name: 'companyText',
        description: 'Company text (auto-generated, optional)',
        sampleValue: ' on behalf of Acme Corp',
      },
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
      {
        name: 'partnerName',
        description: 'Partner name',
        sampleValue: 'John Doe',
      },
      {
        name: 'partnerEmail',
        description: 'Partner email',
        sampleValue: 'john@acme.com',
      },
      {
        name: 'eventTitle',
        description: 'Event title',
        sampleValue: 'LBS Conference 2026',
      },
      {
        name: 'companyText',
        description: 'Company text (auto-generated)',
        sampleValue: ' (Acme Corp)',
      },
      {
        name: 'partnerCompanyHtml',
        description: 'Company row HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'partnerPhoneHtml',
        description: 'Phone row HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'interestDetailsHtml',
        description: 'Interest details HTML (auto-generated)',
        sampleValue: '',
      },
      {
        name: 'viewUrl',
        description: 'Dashboard URL to view inquiry',
        sampleValue:
          'https://pptcrm.powerpointtribe.org/events/partners?id=123',
      },
    ],
  },
  {
    // CMIT — Campus Ministers in Training welcome email. Sent to every person who
    // registers for the CMIT event (wired via the event's confirmationTemplateId,
    // set by the cmit-welcome-template seeder). Uses the same template variables
    // the events registration-confirmation flow provides.
    slug: 'events.cmit-welcome',
    name: 'CMIT Registration Welcome',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.WELCOME,
    subject: "You're invited to CMIT, {{firstName}}",
    htmlContent: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>You're Invited to CMIT</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    a { text-decoration: none; }

    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 26px !important; padding-right: 26px !important; }
      .h1 { font-size: 24px !important; line-height: 30px !important; }
      .detail-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; border: 0 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F4F3F0;">
  <!-- Preheader (hidden) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F4F3F0; opacity:0;">
    A generation of student ministers is rising. CMIT begins 1 August 2026 — fully online. Send your application today.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F3F0;">
    <tr>
      <td align="center" style="padding:28px 16px;">

        <!-- Card -->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border:1px solid #E7E4DE; border-radius:12px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td class="px" style="padding:36px 44px 30px 44px; background-color:#F1EFEA; border-bottom:1px solid #DCD8D0; font-family:'Helvetica Neue',Arial,sans-serif;">
              <p style="margin:0 0 18px 0; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:#908C85; font-weight:700;">
                Dami Oguntunde Teaching Ministries
              </p>
              <h1 class="h1" style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:34px; color:#1B1A18; font-weight:700;">
                Campus Ministers In Training
              </h1>
              <p style="margin:14px 0 0 0; font-size:14px; line-height:21px; color:#908C85;">
                A movement to rebuild strong, value-driven campus ministry for the next generation.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="px" style="padding:30px 44px 4px 44px; font-family:'Helvetica Neue',Arial,sans-serif;">

              <p style="margin:0 0 18px 0; font-family:Georgia,'Times New Roman',serif; font-size:19px; line-height:26px; color:#1B1A18; font-weight:700;">
                Dear {{firstName}},
              </p>

              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                Thank you for indicating interest to be a part of this initiative.
              </p>

              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                Across many campuses in Nigeria today, participation in Christian fellowships and discipleship communities is steadily declining. Yet, there remains a generation of students who carry a genuine burden for God, His Kingdom, and the transformation of their campuses.
              </p>

              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                The <strong style="color:#1B1A18;">Campus Ministers In Training (CMIT)</strong> was created for such students.
              </p>

              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                CMIT is a strategic, interdenominational discipleship and leadership development programme designed to equip university students and emerging campus leaders with the knowledge, convictions, and practical tools needed to thrive in campus ministry.
              </p>

              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                Over five weeks, participants will engage in a structured online learning experience covering the history, importance, challenges, practice, and legacy of campus ministry. Through teaching sessions, mentorship, assignments, and assessments, students will be prepared to become effective disciples and impactful leaders within their institutions.
              </p>

              <p style="margin:0 0 4px 0; font-size:15px; line-height:24px; color:#46443F;">
                Whether you currently serve in a fellowship, desire to strengthen your leadership capacity, or simply have a passion for seeing God move on your campus, CMIT was designed with you in mind.
              </p>

            </td>
          </tr>

          <!-- Details panel -->
          <tr>
            <td class="px" style="padding:24px 44px 0 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F6F3; border-radius:8px;">
                <tr>
                  <td style="padding:22px 26px; font-family:'Helvetica Neue',Arial,sans-serif;">
                    <p style="margin:0 0 16px 0; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#908C85; font-weight:700;">
                      Programme at a glance
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="detail-cell" width="50%" valign="top" style="padding:0 14px 14px 0; font-size:14px; line-height:20px; color:#46443F;">
                          <span style="color:#908C85; font-size:12px;">Begins</span><br><strong style="color:#1B1A18;">1st August 2026</strong>
                        </td>
                        <td class="detail-cell" width="50%" valign="top" style="padding:0 0 14px 14px; font-size:14px; line-height:20px; color:#46443F; border-left:1px solid #E7E4DE;">
                          <span style="color:#908C85; font-size:12px;">Format</span><br><strong style="color:#1B1A18;">Fully online</strong>
                        </td>
                      </tr>
                      <tr>
                        <td class="detail-cell" width="50%" valign="top" style="padding:14px 14px 0 0; font-size:14px; line-height:20px; color:#46443F; border-top:1px solid #E7E4DE;">
                          <span style="color:#908C85; font-size:12px;">Duration</span><br><strong style="color:#1B1A18;">Five weeks</strong>
                        </td>
                        <td class="detail-cell" width="50%" valign="top" style="padding:14px 0 0 14px; font-size:14px; line-height:20px; color:#46443F; border-top:1px solid #E7E4DE; border-left:1px solid #E7E4DE;">
                          <span style="color:#908C85; font-size:12px;">Who it's for</span><br><strong style="color:#1B1A18;">Students across Nigeria</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Closing copy -->
          <tr>
            <td class="px" style="padding:26px 44px 0 44px; font-family:'Helvetica Neue',Arial,sans-serif;">
              <p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:#46443F;">
                We invite you to join a growing community of student ministers committed to rebuilding strong, value-driven campus ministry systems for the next generation.
              </p>
              <p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:25px; color:#1B1A18; font-weight:700;">
                Send your application today and become part of the movement.
              </p>
            </td>
          </tr>

          <!-- CTA button (left-aligned) -->
          <tr>
            <td class="px" style="padding:24px 44px 0 44px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1B1A18" style="border-radius:6px;">
                    <a href="{{applicationUrl}}" target="_blank" style="display:inline-block; padding:14px 38px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; font-weight:700; letter-spacing:0.3px; color:#FFFFFF; background-color:#1B1A18; border-radius:6px;">
                      Send Application
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0 0; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:19px; color:#908C85;">
                Or open this link in your browser:
                <a href="{{applicationUrl}}" target="_blank" style="color:#1B1A18; text-decoration:underline; word-break:break-all;">{{applicationUrl}}</a>
              </p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td class="px" style="padding:24px 44px 38px 44px; font-family:'Helvetica Neue',Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height:1px; background-color:#E7E4DE; line-height:1px; font-size:0;">&nbsp;</td></tr>
              </table>
              <p style="margin:22px 0 4px 0; font-size:15px; line-height:22px; color:#46443F;">
                Warm regards,
              </p>
              <p style="margin:0; font-size:15px; line-height:22px; color:#1B1A18; font-weight:700;">
                The CMIT Team
              </p>
              <p style="margin:0; font-size:13px; line-height:20px; color:#908C85;">
                Dami Oguntunde Teaching Ministries
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

        <!-- Footer -->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
          <tr>
            <td align="center" style="padding:24px 40px; font-family:'Helvetica Neue',Arial,sans-serif;">
              <p style="margin:0 0 6px 0; font-size:11px; line-height:17px; color:#A8A39B;">
                You're receiving this email because you indicated interest for Campus Ministers In Training.
              </p>
              <p style="margin:0; font-size:11px; line-height:17px; color:#A8A39B;">
                &copy; {{year}} Dami Oguntunde Teaching Ministries
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`,
    variableDefinitions: [
      {
        name: 'firstName',
        description: 'Registrant first name',
        sampleValue: 'Adaeze',
      },
      {
        name: 'applicationUrl',
        description: 'Per-registrant application form link',
        sampleValue: 'https://cmithub.org/apply/abc123',
      },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.session-recording-ready',
    name: 'Session Recording Ready (Facilitator)',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: 'Recording ready — {{sessionTitle}}',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8eaf0;border-radius:16px;overflow:hidden;">
  <div style="background:#18216C;padding:30px 30px 26px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A227;">CMIT &middot; Session recording</p>
    <h1 style="margin:10px 0 0;font-size:21px;font-weight:700;color:#ffffff;line-height:1.3;">The recording is ready</h1>
  </div>
  <div style="padding:28px 30px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1a2340;">Hi {{firstName}},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#525a72;line-height:1.6;"><strong style="color:#1a2340;">{{sessionTitle}}</strong> has finished and its replay is now available. Publish it to a module so your trainees can watch it back.</p>
    <div style="text-align:center;margin:0 0 22px;">
      <a href="{{dashboardUrl}}" style="display:inline-block;background:#C9A227;color:#18216C;font-size:14px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">Publish the recording &rarr;</a>
    </div>
    <p style="margin:0;font-size:13px;color:#8a90a6;line-height:1.6;text-align:center;">Prefer to preview it first? <a href="{{recordingUrl}}" style="color:#18216C;font-weight:600;">Watch on YouTube</a></p>
  </div>
  <div style="padding:20px 30px;border-top:1px solid #f0f1f6;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a2a7ba;font-weight:600;">CMIT &mdash; Campus Ministers in Training</p>
    <p style="margin:5px 0 0;font-size:11px;color:#c2c6d4;">A vision of Dami Oguntunde Teaching Ministries</p>
  </div>
</div>`,
    variableDefinitions: [
      {
        name: 'firstName',
        description: 'Facilitator first name',
        sampleValue: 'Dami',
      },
      {
        name: 'sessionTitle',
        description: 'Session title',
        sampleValue: 'Week 1 — The History of Campus Ministry',
      },
      {
        name: 'dashboardUrl',
        description: 'Facilitator dashboard sessions link',
        sampleValue: 'https://cmithub.org/facilitator/sessions',
      },
      {
        name: 'recordingUrl',
        description: 'YouTube recording link',
        sampleValue: 'https://www.youtube.com/watch?v=4O048K5OHUQ',
      },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.session-recording-available',
    name: 'Session Recording Available (Student)',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: 'Watch the replay — {{sessionTitle}}',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8eaf0;border-radius:16px;overflow:hidden;">
  <div style="background:#18216C;padding:30px 30px 26px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A227;">CMIT &middot; Replay available</p>
    <h1 style="margin:10px 0 0;font-size:21px;font-weight:700;color:#ffffff;line-height:1.3;">Watch the session replay</h1>
  </div>
  <div style="padding:28px 30px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1a2340;">Hi {{firstName}},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#525a72;line-height:1.6;">The replay of <strong style="color:#1a2340;">{{sessionTitle}}</strong> is now available in <strong style="color:#1a2340;">{{moduleTitle}}</strong>. Missed it live, or want to review? Watch it back anytime in your portal.</p>
    <div style="text-align:center;margin:0 0 22px;">
      <a href="{{watchUrl}}" style="display:inline-block;background:#C9A227;color:#18216C;font-size:14px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">Watch the replay &rarr;</a>
    </div>
    <p style="margin:0;font-size:13px;color:#8a90a6;line-height:1.6;text-align:center;">You'll also find it under <strong style="color:#525a72;">{{moduleTitle}}</strong> in your learning portal.</p>
  </div>
  <div style="padding:20px 30px;border-top:1px solid #f0f1f6;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a2a7ba;font-weight:600;">CMIT &mdash; Campus Ministers in Training</p>
    <p style="margin:5px 0 0;font-size:11px;color:#c2c6d4;">A vision of Dami Oguntunde Teaching Ministries</p>
  </div>
</div>`,
    variableDefinitions: [
      {
        name: 'firstName',
        description: 'Student first name',
        sampleValue: 'Adaeze',
      },
      {
        name: 'sessionTitle',
        description: 'Session title',
        sampleValue: 'Week 1 — The History of Campus Ministry',
      },
      {
        name: 'moduleTitle',
        description: 'Module the recording was published to',
        sampleValue: 'Module 1 — Foundations',
      },
      {
        name: 'watchUrl',
        description: 'Portal lesson link for the replay',
        sampleValue: 'https://cmithub.org/portal/lessons/abc123',
      },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.application-reminder',
    name: 'Application Reminder (Incomplete)',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.REMINDER,
    subject: 'Finish your CMIT application',
    htmlContent: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e8eaf0;border-radius:16px;overflow:hidden;">
  <div style="background:#18216C;padding:30px 30px 26px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A227;">CMIT &middot; Application</p>
    <h1 style="margin:10px 0 0;font-size:21px;font-weight:700;color:#ffffff;line-height:1.3;">You're almost there</h1>
  </div>
  <div style="padding:28px 30px;">
    <p style="margin:0 0 16px;font-size:15px;color:#1a2340;">Hi {{firstName}},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#525a72;line-height:1.6;">You registered for CMIT but haven't finished your application yet. It only takes a few minutes &mdash; and applications are reviewed on a rolling basis, so it's best to complete yours soon.</p>
    <div style="text-align:center;margin:0 0 22px;">
      <a href="{{applicationUrl}}" style="display:inline-block;background:#C9A227;color:#18216C;font-size:14px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;">Finish my application &rarr;</a>
    </div>
    <p style="margin:0;font-size:13px;color:#8a90a6;line-height:1.6;text-align:center;">Your progress is saved to your personal link &mdash; just pick up where you left off.</p>
  </div>
  <div style="padding:20px 30px;border-top:1px solid #f0f1f6;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a2a7ba;font-weight:600;">CMIT &mdash; Campus Ministers in Training</p>
    <p style="margin:5px 0 0;font-size:11px;color:#c2c6d4;">A vision of Dami Oguntunde Teaching Ministries</p>
  </div>
</div>`,
    variableDefinitions: [
      {
        name: 'firstName',
        description: 'Registrant first name',
        sampleValue: 'Adaeze',
      },
      {
        name: 'applicationUrl',
        description: 'Per-registrant application form link',
        sampleValue: 'https://cmithub.org/apply/abc123',
      },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
  {
    slug: 'events.cmit-partner-update',
    name: 'CMIT Partner Progress Update',
    module: TemplateModule.EVENTS,
    category: TemplateCategory.EVENT,
    subject: 'CMIT Partner Update — {{subject}}',
    htmlContent: `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>CMIT — Partner Progress Update</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display:ital@0;1&display=swap');

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    img { border: 0; display: block; }
    a { text-decoration: none; }

    body {
      background: #EAECF4;
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #2C2C3E;
      -webkit-font-smoothing: antialiased;
    }

    .pre {
      display: none; max-height: 0; overflow: hidden; mso-hide: all;
      font-size: 1px; color: #EAECF4; line-height: 1px;
    }

    .shell {
      max-width: 600px;
      margin: 28px auto;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(24,33,108,0.10);
    }

    .hd {
      background: #18216C;
      border-radius: 12px 12px 0 0;
      padding: 14px 32px;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .hd-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .hd-tag {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.40);
    }

    .hd-pill {
      background: rgba(212,175,55,0.15);
      border: 1px solid rgba(212,175,55,0.40);
      color: #D4AF37;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 100px;
    }

    .hd-logo {
      width: 200px;
      height: auto;
      display: block;
    }

    .hd-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.38);
      white-space: nowrap;
    }

    .hd-rule {
      width: 36px;
      height: 2px;
      background: #D4AF37;
      margin: 20px auto 0;
      border-radius: 2px;
    }

    .bd {
      background: #fff;
      padding: 36px 40px 32px;
    }

    .g-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #D4AF37;
      margin-bottom: 6px;
    }

    .g-head {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 24px;
      color: #18216C;
      line-height: 1.3;
      margin-bottom: 20px;
    }

    .p {
      font-size: 14px;
      line-height: 1.75;
      color: #4A4A63;
      margin-bottom: 14px;
    }

    .p:last-of-type { margin-bottom: 0; }

    .rule {
      border: none;
      border-top: 1px solid #EDEEF5;
      margin: 28px 0;
    }

    .sec-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: #18216C;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sec-label::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #EDEEF5;
    }

    .stats {
      display: flex;
      border: 1px solid #EDEEF5;
      border-radius: 10px;
      overflow: hidden;
      margin: 20px 0 28px;
    }

    .stat {
      flex: 1;
      padding: 16px 12px;
      text-align: center;
      border-right: 1px solid #EDEEF5;
    }

    .stat:last-child { border-right: none; }

    .stat-n {
      font-size: 24px;
      font-weight: 700;
      color: #18216C;
      letter-spacing: -0.5px;
      line-height: 1;
    }

    .stat-n sup {
      font-size: 13px;
      color: #D4AF37;
      font-weight: 700;
      vertical-align: super;
    }

    .stat-l {
      font-size: 10px;
      color: #9898B0;
      margin-top: 4px;
      letter-spacing: 0.3px;
      font-weight: 500;
    }

    .ms-list { list-style: none; }

    .ms {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid #F4F4FA;
    }

    .ms:last-child { border-bottom: none; padding-bottom: 0; }
    .ms:first-child { padding-top: 0; }

    .ms-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background: #18216C;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }

    .ms-text {
      font-size: 13.5px;
      line-height: 1.65;
      color: #4A4A63;
    }

    .ms-text strong { color: #18216C; font-weight: 600; }
    .ms-text a { color: #18216C; text-decoration: underline; text-underline-offset: 2px; }

    .pull {
      border-left: 2px solid #D4AF37;
      padding: 12px 18px;
      margin: 24px 0;
      background: #FAFAFA;
      border-radius: 0 6px 6px 0;
    }

    .pull p {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 15px;
      font-style: italic;
      color: #18216C;
      line-height: 1.65;
    }

    .needs {
      background: #F8F9FD;
      border-radius: 8px;
      padding: 4px 18px;
      margin: 14px 0;
    }

    .need {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 0;
      border-bottom: 1px solid #EDEEF5;
      font-size: 13px;
      color: #4A4A63;
    }

    .need:last-child { border-bottom: none; }

    .need-dot {
      width: 5px;
      height: 5px;
      background: #D4AF37;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .cta {
      background: #18216C;
      border-radius: 10px;
      padding: 28px 32px;
      margin: 24px 0;
      text-align: center;
    }

    .cta-ey {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: #D4AF37;
      margin-bottom: 8px;
    }

    .cta-h {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 20px;
      color: #fff;
      margin-bottom: 10px;
      line-height: 1.3;
    }

    .cta-p {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
      line-height: 1.75;
    }

    .cta-p strong { color: #D4AF37; font-weight: 600; }

    .bank {
      border: 1px solid #E8D98A;
      border-radius: 8px;
      overflow: hidden;
      margin: 18px 0;
    }

    .bank-hd {
      background: #D4AF37;
      padding: 8px 18px;
    }

    .bank-hd span {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #18216C;
    }

    .bank-bd { padding: 2px 18px 6px; }

    .bank-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #F5EDBA;
    }

    .bank-row:last-child { border-bottom: none; }

    .brl { font-size: 11px; color: #AAA; font-weight: 500; }

    .brv { font-size: 13px; font-weight: 600; color: #18216C; }

    .brv.acct { font-size: 18px; font-weight: 700; letter-spacing: 2px; }

    .contact {
      background: #F8F9FD;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 18px 0;
    }

    .contact-ey {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #18216C;
      margin-bottom: 10px;
    }

    .cr {
      font-size: 13px;
      color: #4A4A63;
      margin-bottom: 5px;
      line-height: 1.5;
    }

    .cr:last-child { margin-bottom: 0; }

    .cr span { color: #B0B0C8; margin-right: 5px; font-size: 12px; }
    .cr a { color: #18216C; font-weight: 500; }

    .sig {
      margin-top: 28px;
      padding-top: 22px;
      border-top: 1px solid #EDEEF5;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .sig-cl { font-size: 13px; color: #9898B0; margin-bottom: 12px; }

    .sig-name {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 18px;
      color: #18216C;
    }

    .sig-title { font-size: 11.5px; color: #9898B0; margin-top: 3px; line-height: 1.5; }

    .sig-shield { width: 36px; height: auto; opacity: 0.9; }

    .ft {
      background: #18216C;
      padding: 22px 40px;
      text-align: center;
    }

    .ft-links { margin-bottom: 12px; }

    .ft-links a {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      margin: 0 8px;
      letter-spacing: 0.5px;
    }

    .ft-links a:hover { color: #D4AF37; }

    .ft-rule {
      width: 28px;
      height: 1px;
      background: rgba(212,175,55,0.3);
      margin: 12px auto;
    }

    .ft-info {
      font-size: 11.5px;
      color: rgba(255,255,255,0.50);
      margin-bottom: 3px;
    }

    .ft-info a { color: rgba(255,255,255,0.55); }

    .ft-legal {
      font-size: 10px;
      color: rgba(255,255,255,0.22);
      margin-top: 12px;
      line-height: 1.8;
    }

    .ft-legal a { color: rgba(255,255,255,0.22); text-decoration: underline; }

    @media (max-width: 640px) {
      .shell { margin: 0; border-radius: 0; box-shadow: none; }
      .hd { padding: 20px 24px !important; border-radius: 0 !important; gap: 14px !important; }
      .bd, .ft { padding-left: 24px !important; padding-right: 24px !important; }
      .hd-logo { width: 160px !important; }
      .stats { flex-direction: column; }
      .stat { border-right: none; border-bottom: 1px solid #EDEEF5; }
      .stat:last-child { border-bottom: none; }
      .sig { flex-direction: column; align-items: flex-start; gap: 14px; }
      .bank-row { flex-direction: column; align-items: flex-start; gap: 2px; }
    }
  </style>
</head>
<body>
  <div class="pre">{{preheader}}</div>

  <div class="shell">

    <!-- HEADER -->
    <div class="hd">
      <div>
        <div class="hd-tag">CMIT &middot; Campus Ministers in Training</div>
        <div style="font-family:'DM Serif Display',Georgia,serif;font-size:18px;color:#fff;margin-top:6px;">Partner Update</div>
      </div>
    </div>

    <!-- BODY -->
    <div class="bd">

      <div class="hd-meta">
        <span class="hd-tag" style="color:#9898B0;">Partner Communication</span>
        <span class="hd-pill">Cohort 01</span>
      </div>

      <!-- Greeting -->
      <div class="g-label">Dear Partner</div>
      <h2 class="g-head">{{name}},</h2>

      <!-- Dynamic message body -->
      {{messageBody}}

      <!-- Signature -->
      <div class="sig">
        <div class="sig-left">
          <p class="sig-cl">With gratitude,</p>
          <p class="sig-name">The CMIT Team</p>
          <p class="sig-title">A vision of Dami Oguntunde Teaching Ministries</p>
        </div>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="ft">
      <div class="ft-links">
        <a href="https://cmithub.org">Website</a>
        <a href="mailto:info@cmithub.org">Email</a>
      </div>
      <div class="ft-rule"></div>
      <p class="ft-info">CMIT &mdash; Campus Ministers in Training</p>
      <p class="ft-info">A vision of Dami Oguntunde Teaching Ministries</p>
      <p class="ft-legal">&copy; {{year}} Dami Oguntunde Teaching Ministries. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`,
    variableDefinitions: [
      {
        name: 'name',
        description: 'Partner name (auto-replaced per recipient)',
        sampleValue: 'Pastor Ayomide Arowele',
      },
      {
        name: 'messageBody',
        description:
          'Main email content HTML — use the CSS classes (.p, .rule, .sec-label, .stats, .stat, .ms-list, .ms, .pull, .needs, .need, .cta, .bank, .contact) for rich formatting',
        sampleValue:
          '<p class="p">Thank you for your partnership with CMIT. Here is your latest update.</p>',
      },
      {
        name: 'preheader',
        description: 'Hidden preview text shown in inbox',
        sampleValue: 'CMIT Progress Update — Cohort 1 launches 1 August 2026.',
      },
      { name: 'year', description: 'Current year', sampleValue: '2026' },
    ],
  },
];

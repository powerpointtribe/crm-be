import { TemplateCategory, TemplateModule } from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

export const authDefaults: TemplateDefinition[] = [
  {
    slug: 'auth.user-invitation',
    name: 'User Invitation',
    module: TemplateModule.AUTH,
    category: TemplateCategory.WELCOME,
    subject: 'Your Account Is Ready — Login Details Inside',
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;">

      <!-- Header -->
      <tr>
        <td style="background:#4F46E5;padding:36px 24px;text-align:center;">
          <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.2px;">Welcome to Church Management</h1>
          <p style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.85);">Your account has been created</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1f2937;">Hello {{firstName}} {{lastName}},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4b5563;">An account has been created for you. Here are your login credentials:</p>

          <!-- Credentials Box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #eee;border-radius:8px;margin-bottom:20px;">
            <tr>
              <td style="padding:16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#6b7280;width:110px;vertical-align:top;">Email</td>
                    <td style="padding:4px 0;font-size:14px;color:#1f2937;font-weight:500;">{{email}}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:6px 0;"><div style="border-top:1px solid #e5e7eb;"></div></td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#6b7280;width:110px;vertical-align:top;">Password</td>
                    <td style="padding:4px 0;font-size:14px;color:#1f2937;"><code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;font-family:'SF Mono',Menlo,Consolas,monospace;">{{temporaryPassword}}</code></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:6px 0;"><div style="border-top:1px solid #e5e7eb;"></div></td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#6b7280;width:110px;vertical-align:top;">Role</td>
                    <td style="padding:4px 0;font-size:14px;color:#1f2937;font-weight:500;">{{roleDisplayName}}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Warning Box -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
                <p style="margin:0;font-size:13px;line-height:1.55;color:#92400e;"><strong>Important:</strong> Please change your password after your first login.</p>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:4px 0 24px;">
                <a href="{{loginUrl}}" target="_blank" style="display:inline-block;background:#4F46E5;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;">Login to Your Account</a>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;line-height:1.55;color:#6b7280;">If you have questions, contact your church administrator.</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.55;">God bless,<br/>Church Management System</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    variableDefinitions: [
      { name: 'firstName', description: 'User first name', sampleValue: 'John' },
      { name: 'lastName', description: 'User last name', sampleValue: 'Doe' },
      { name: 'email', description: 'User login email', sampleValue: 'john@example.com' },
      { name: 'temporaryPassword', description: 'Temporary password', sampleValue: 'TempPass123!' },
      { name: 'roleDisplayName', description: 'Assigned role name', sampleValue: 'Member' },
      { name: 'loginUrl', description: 'Login page URL', sampleValue: 'https://pptcrm.powerpointtribe.org/login' },
    ],
  },
];

/**
 * First-Timer Welcome Email Templates
 * 3 modern, compact, elegantly designed HTML email templates.
 */

export type TemplateId = 1 | 2 | 3;

interface TemplateData {
  firstName: string;
  messageBody: string;
  subject: string;
}

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  previewHtml: string;
}

const SOCIAL = {
  instagram: 'https://www.instagram.com/powerpointtribe/',
  twitter: 'https://x.com/powerpointtribe',
  youtube: 'https://www.youtube.com/@PowerPointTribeGlobal',
  spotify: 'https://open.spotify.com/show/1Y77nSgv5eiXdgqDFtROjf?si=1fe8333ee69647e9',
};

const B = {
  teal: '#0D7770',
  tealDk: '#095D58',
  tealLt: '#0FA89E',
  name: 'The PowerPoint Tribe',
  email: 'info@powerpointtribe.org',
};

// ── Shared: elegant compact footer with SVG social icons ──
// Using inline SVG data URIs for maximum email client compatibility
const ICONS = {
  instagram: `<img src="https://cdn.simpleicons.org/instagram/E4405F" alt="Instagram" width="18" height="18" style="display:block;" />`,
  x: `<img src="https://cdn.simpleicons.org/x/000000" alt="X" width="18" height="18" style="display:block;" />`,
  youtube: `<img src="https://cdn.simpleicons.org/youtube/FF0000" alt="YouTube" width="18" height="18" style="display:block;" />`,
  spotify: `<img src="https://cdn.simpleicons.org/spotify/1DB954" alt="Spotify" width="18" height="18" style="display:block;" />`,
};

function socialIcon(href: string, icon: string): string {
  return `<td align="center" valign="middle" style="padding:0 6px;">
    <a href="${href}" target="_blank" style="text-decoration:none;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" valign="middle" width="36" height="36" style="width:36px;height:36px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:18px;">
          ${icon}
        </td>
      </tr></table>
    </a>
  </td>`;
}

function footer(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#d1d5db,transparent);"></td></tr>
      <tr>
        <td align="center" style="padding:20px 0 0;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            ${socialIcon(SOCIAL.instagram, ICONS.instagram)}
            ${socialIcon(SOCIAL.twitter, ICONS.x)}
            ${socialIcon(SOCIAL.youtube, ICONS.youtube)}
            ${socialIcon(SOCIAL.spotify, ICONS.spotify)}
          </tr></table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:12px 0 0;">
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">${B.name} &middot; <a href="mailto:${B.email}" style="color:${B.teal};text-decoration:none;">${B.email}</a></p>
        </td>
      </tr>
    </table>`;
}

function wrap(inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${B.name}</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;"><tr><td align="center" style="padding:32px 12px;">${inner}</td></tr></table>
</body></html>`;
}

// ════════════════════════════════════════════════
// Template 1 — Warm & Personal
// Soft, rounded, friendly. Feels like a note from a friend.
// ════════════════════════════════════════════════
function template1(d: TemplateData): string {
  return wrap(`
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 8px 24px rgba(0,0,0,0.06);">
      <tr><td style="height:4px;background:${B.teal};"></td></tr>
      <tr>
        <td style="padding:28px 32px 0;text-align:center;">
          <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background:linear-gradient(135deg,${B.teal},${B.tealLt});color:#fff;font-size:20px;font-weight:700;text-align:center;">${d.firstName.charAt(0)}</div>
          <h1 style="margin:12px 0 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Hey ${d.firstName}!</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Welcome to ${B.name}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 28px;">
          <div style="font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap;">${d.messageBody}</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
            <tr><td><p style="margin:0;font-size:13px;color:#6b7280;">With love,</p><p style="margin:2px 0 0;font-size:14px;color:${B.teal};font-weight:600;">${B.name} Family</p></td></tr>
          </table>
          ${footer()}
        </td>
      </tr>
    </table>`);
}

// ════════════════════════════════════════════════
// Template 2 — Professional & Polished
// Minimal, structured, editorial. Left accent border.
// ════════════════════════════════════════════════
function template2(d: TemplateData): string {
  return wrap(`
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06);">
      <tr>
        <td style="padding:28px 28px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td><p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${B.teal};">${B.name}</p></td>
              <td align="right"><div style="display:inline-block;padding:3px 10px;background:#f0fdf4;border-radius:100px;font-size:10px;font-weight:600;color:${B.teal};letter-spacing:0.5px;">WELCOME</div></td>
            </tr>
          </table>
          <div style="margin:16px 0 0;height:1px;background:#f3f4f6;"></div>
        </td>
      </tr>
      <tr><td style="padding:20px 28px 0;"><h1 style="margin:0;font-size:18px;font-weight:700;color:#111827;">Dear ${d.firstName},</h1></td></tr>
      <tr>
        <td style="padding:16px 28px 28px;">
          <div style="font-size:14px;color:#4b5563;line-height:1.75;white-space:pre-wrap;">${d.messageBody}</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
            <tr><td><p style="margin:0;font-size:13px;color:#9ca3af;">Warmly,</p><p style="margin:2px 0 0;font-size:14px;color:#111827;font-weight:600;">${B.name} Team</p></td></tr>
          </table>
          ${footer()}
        </td>
      </tr>
    </table>`);
}

// ════════════════════════════════════════════════
// Template 3 — Vibrant & Energetic
// Bold header, gradient accent, high-energy community feel.
// ════════════════════════════════════════════════
function template3(d: TemplateData): string {
  return wrap(`
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.04),0 12px 32px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,${B.tealDk} 0%,${B.teal} 40%,${B.tealLt} 100%);padding:32px 28px;text-align:center;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.7);">Welcome to the Family</p>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;line-height:1.3;">${d.firstName}, welcome!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 28px;">
          <div style="font-size:14px;color:#374151;line-height:1.75;white-space:pre-wrap;">${d.messageBody}</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
            <tr><td><p style="margin:0;font-size:13px;color:#6b7280;">Let's do life together,</p><p style="margin:2px 0 0;font-size:14px;color:${B.teal};font-weight:700;">${B.name} Crew</p></td></tr>
          </table>
          ${footer()}
        </td>
      </tr>
    </table>`);
}

// ── Public API ──

const generators: Record<TemplateId, (d: TemplateData) => string> = {
  1: template1,
  2: template2,
  3: template3,
};

export function generateEmailHtml(templateId: TemplateId, data: TemplateData): string {
  return (generators[templateId] || generators[1])(data);
}

export function getTemplatePreviewData(): TemplateInfo[] {
  const sample: TemplateData = {
    firstName: 'Friend',
    messageBody: 'We hope you had an amazing time at the service! It was such a blessing having you with us. We believe God has something special in store for you, and we would love to be a part of your journey.',
    subject: 'Welcome to The PowerPoint Tribe',
  };

  return [
    { id: 1, name: 'Warm & Personal', description: 'Friendly and conversational — feels like a note from a close friend.', previewHtml: template1(sample) },
    { id: 2, name: 'Professional & Polished', description: 'Clean and structured with editorial styling — formal yet warm.', previewHtml: template2(sample) },
    { id: 3, name: 'Vibrant & Energetic', description: 'Bold gradient header with high-energy community feel.', previewHtml: template3(sample) },
  ];
}

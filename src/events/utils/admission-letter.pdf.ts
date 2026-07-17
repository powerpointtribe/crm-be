// pdfkit uses `export =` (CommonJS). Import-equals works whether or not
// esModuleInterop is enabled, so the constructor resolves correctly at runtime.
import PDFDocument = require('pdfkit');
import * as path from 'path';
import { CMIT_LOGO_BASE64 } from './cmit-logo.asset';

// Brand typeface: Manrope (same as the CMIT website). Static TTFs are loaded
// from the installed @expo-google-fonts package, so this works in dev and in
// the built dist (node_modules is present in both). Font aliases: R=Regular,
// M=Medium, SB=SemiBold, B=Bold.
const MANROPE_DIR = path.dirname(
  require.resolve('@expo-google-fonts/manrope/package.json'),
);
const FONTS = {
  R: path.join(MANROPE_DIR, '400Regular', 'Manrope_400Regular.ttf'),
  M: path.join(MANROPE_DIR, '500Medium', 'Manrope_500Medium.ttf'),
  SB: path.join(MANROPE_DIR, '600SemiBold', 'Manrope_600SemiBold.ttf'),
  B: path.join(MANROPE_DIR, '700Bold', 'Manrope_700Bold.ttf'),
};

/**
 * CMIT admission-letter PDF generator. Reproduces the official 2-page letter
 * (header, unique Student ID box, programme details table, numbered next
 * steps, expectations, signature) with the registrant's variables filled in.
 *
 * Returns the finished PDF as a Buffer, ready to attach to an email.
 */

const NAVY = '#18216C';
const GOLD = '#C9A227';
const INK = '#333333';
const DARK = '#1a2340';
const MUTED = '#6b7280';
const ROW = '#F3F4F6';

// CMIT dark-shield logo, embedded (no network fetch). Source is 702×868.
const LOGO = Buffer.from(CMIT_LOGO_BASE64, 'base64');
const LOGO_ASPECT = 702 / 868; // width / height

export interface AdmissionLetterData {
  studentName: string;
  studentId: string;
  issueDate: string; // e.g. "16 July 2026"
}

const M = { left: 64, right: 64, top: 54 };
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - M.left - M.right;

export async function buildAdmissionLetterPdf(
  data: AdmissionLetterData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: M.top, bottom: 74, left: M.left, right: M.right },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.registerFont('R', FONTS.R);
      doc.registerFont('M', FONTS.M);
      doc.registerFont('SB', FONTS.SB);
      doc.registerFont('B', FONTS.B);

      const header = () => {
        const y = M.top;
        const logoH = 40;
        const logoW = logoH * LOGO_ASPECT;
        try {
          doc.image(LOGO, M.left, y - 3, { width: logoW, height: logoH });
        } catch {
          /* ignore bad image */
        }
        const tx = M.left + logoW + 14;
        doc
          .font('B')
          .fontSize(11.5)
          .fillColor(NAVY)
          .text('CAMPUS MINISTERS IN TRAINING', tx, y + 3, {
            characterSpacing: 0.3,
          });
        doc
          .font('M')
          .fontSize(7.5)
          .fillColor(MUTED)
          .text('Powered by Dami Oguntunde Teaching Ministries', tx, y + 18);
        doc.x = M.left;
        doc.y = y + logoH + 10;
      };

      // Minimal stroke icons for the footer (Lucide-style), drawn in an s×s box.
      const drawFooterIcon = (
        kind: string,
        x: number,
        y: number,
        s: number,
      ) => {
        doc.save();
        doc.lineWidth(0.7).strokeColor(MUTED);
        const cx = x + s / 2;
        const cy = y + s / 2;
        const r = s / 2;
        if (kind === 'globe') {
          doc.circle(cx, cy, r).stroke();
          doc
            .moveTo(x, cy)
            .lineTo(x + s, cy)
            .stroke();
          doc.ellipse(cx, cy, r * 0.5, r).stroke();
        } else if (kind === 'mail') {
          doc.rect(x, y + s * 0.16, s, s * 0.68).stroke();
          doc
            .moveTo(x, y + s * 0.16)
            .lineTo(cx, y + s * 0.55)
            .lineTo(x + s, y + s * 0.16)
            .stroke();
        } else if (kind === 'phone') {
          doc.roundedRect(x + s * 0.24, y, s * 0.52, s, 1.4).stroke();
          doc.circle(cx, y + s * 0.82, 0.55).fill(MUTED);
        } else if (kind === 'ig') {
          doc.roundedRect(x, y, s, s, s * 0.28).stroke();
          doc.circle(cx, cy, s * 0.25).stroke();
          doc.circle(x + s * 0.75, y + s * 0.25, 0.7).fill(MUTED);
        }
        doc.restore();
      };

      const footer = (pageNo: number, total: number) => {
        // Zero the bottom margin while drawing so placing text in the footer
        // zone doesn't trigger an automatic (blank) page break.
        const prevBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const items = [
          { icon: 'globe', text: 'cmithub.org' },
          { icon: 'mail', text: 'cmithub@gmail.com' },
          { icon: 'phone', text: '+234 813 697 1500' },
          { icon: 'ig', text: '@CMITHub' },
        ];
        const iconSize = 8;
        const iconGap = 4;
        const segGap = 16;
        doc.font('R').fontSize(7.5);
        const segW = items.map(
          (it) => iconSize + iconGap + doc.widthOfString(it.text),
        );
        const totalW =
          segW.reduce((a, b) => a + b, 0) + segGap * (items.length - 1);
        let x = (PAGE_W - totalW) / 2;
        const rowY = PAGE_H - 54;
        items.forEach((it, i) => {
          drawFooterIcon(it.icon, x, rowY - 0.5, iconSize);
          doc
            .fillColor(MUTED)
            .text(it.text, x + iconSize + iconGap, rowY, { lineBreak: false });
          x += segW[i] + segGap;
        });

        doc
          .font('R')
          .fontSize(7)
          .fillColor('#a6abbd')
          .text(`Page ${pageNo} of ${total}`, M.left, PAGE_H - 38, {
            width: CONTENT_W,
            align: 'center',
            lineBreak: false,
          });
        doc.page.margins.bottom = prevBottom;
      };

      const heading = (text: string, gap = 16) => {
        doc.moveDown(gap / 14);
        doc.x = M.left;
        doc
          .font('B')
          .fontSize(13)
          .fillColor(NAVY)
          .text(text, { width: CONTENT_W });
        doc.moveDown(0.6);
      };

      const para = (text: string, opts: Record<string, unknown> = {}) => {
        doc.x = M.left;
        doc
          .font('R')
          .fontSize(10)
          .fillColor(INK)
          .text(text, { lineGap: 4, width: CONTENT_W, ...opts });
        doc.moveDown(0.85);
      };

      // Numbered "next step": navy chip + gold heading + body.
      const step = (n: number, title: string, body: string) => {
        const top = doc.y;
        doc.roundedRect(M.left, top, 21, 19, 2.5).fill(NAVY);
        doc
          .font('B')
          .fontSize(10.5)
          .fillColor('#ffffff')
          .text(String(n), M.left, top + 4.5, { width: 21, align: 'center' });
        const x = M.left + 32;
        const w = CONTENT_W - 32;
        doc
          .font('SB')
          .fontSize(11)
          .fillColor(GOLD)
          .text(title, x, top + 3, { width: w });
        doc
          .font('R')
          .fontSize(10)
          .fillColor(INK)
          .text(body, x, doc.y + 4, { width: w, lineGap: 3.6 });
        doc.moveDown(1.05);
      };

      const bullet = (text: string) => {
        const top = doc.y;
        doc.circle(M.left + 4, top + 6.5, 2).fill(GOLD);
        doc
          .font('R')
          .fontSize(10)
          .fillColor(INK)
          .text(text, M.left + 16, top, {
            width: CONTENT_W - 16,
            lineGap: 3.6,
          });
        doc.moveDown(0.6);
      };

      // ── PAGE 1 ──────────────────────────────────────────────────────────
      header();

      doc.font('B').fontSize(9.5).fillColor(NAVY).text('Date: ', {
        continued: true,
      });
      doc.font('R').fillColor(INK).text(data.issueDate);
      doc.moveDown(0.15);
      doc.font('B').fillColor(NAVY).text('Ref: ', {
        continued: true,
      });
      doc.font('R').fillColor(INK).text(data.studentId);
      doc.moveDown(0.85);

      // RE title with gold left bar.
      const reTop = doc.y;
      const reText =
        'RE: OFFER OF ADMISSION — CAMPUS MINISTERS IN TRAINING (CMIT) COHORT 1';
      doc.font('B').fontSize(11.5).fillColor(NAVY);
      const reH = doc.heightOfString(reText, { width: CONTENT_W - 16 });
      doc.rect(M.left, reTop - 1, 4, reH + 2).fill(GOLD);
      doc
        .fillColor(NAVY)
        .text(reText, M.left + 16, reTop, { width: CONTENT_W - 16 });
      doc.moveDown(0.9);

      para(`Dear ${data.studentName},`);
      para(
        'We are pleased to inform you that you have been formally admitted into the maiden cohort of the Campus Ministers in Training (CMIT) initiative.',
      );
      para(
        'Following your successful registration and verification, you are now part of a community of students committed to spiritual growth, discipleship, and leadership development for effective campus ministry.',
      );
      para(
        'CMIT is an interdenominational discipleship and leadership development programme designed to equip a new generation of spiritually grounded campus ministers and fellowship leaders across Nigerian universities. We are delighted to welcome you as we begin this journey together.',
      );

      // Student ID box.
      doc.moveDown(0.35);
      const boxTop = doc.y;
      const boxH = 78;
      doc.roundedRect(M.left, boxTop, CONTENT_W, boxH, 8).fill(NAVY);
      doc
        .font('SB')
        .fontSize(8.5)
        .fillColor(GOLD)
        .text('YOUR UNIQUE CMIT STUDENT ID', M.left, boxTop + 15, {
          width: CONTENT_W,
          align: 'center',
          characterSpacing: 1.4,
        });
      doc
        .font('B')
        .fontSize(21)
        .fillColor('#ffffff')
        .text(data.studentId, M.left, boxTop + 30, {
          width: CONTENT_W,
          align: 'center',
        });
      doc
        .font('R')
        .fontSize(7.5)
        .fillColor('#c9cede')
        .text(
          'Please keep this number for your records and reference it whenever you contact the CMIT Administration Team.',
          M.left + 30,
          boxTop + 59,
          { width: CONTENT_W - 60, align: 'center' },
        );
      doc.y = boxTop + boxH + 14;

      // Programme Details table.
      heading('Programme Details', 6);
      const rows: [string, string][] = [
        ['Start Date', 'Saturday, 1st August 2026'],
        ['Duration', '5 Weeks'],
        ['Session Schedule', 'Saturdays'],
        [
          'Session Structure',
          '2 Hours of Teaching + 1 Hour of Interactive Q&A',
        ],
        ['Delivery Mode', 'Online (YouTube)'],
        ['Learning Platform', 'CMIT Learning Portal'],
        ['Community Platform', 'CMIT WhatsApp Community'],
      ];
      const rowH = 27;
      const labelW = 168;
      rows.forEach(([label, value], i) => {
        const y = doc.y;
        if (i % 2 === 0) doc.rect(M.left, y, CONTENT_W, rowH).fill(ROW);
        doc
          .font('SB')
          .fontSize(9.5)
          .fillColor(NAVY)
          .text(label, M.left + 14, y + 9, { width: labelW - 14 });
        doc
          .font('R')
          .fontSize(9.5)
          .fillColor(INK)
          .text(value, M.left + labelW, y + 9, {
            width: CONTENT_W - labelW - 14,
          });
        doc.y = y + rowH;
      });

      // ── PAGE 2 — Next Steps starts fresh and stays unbroken ─────────────
      doc.addPage();
      header();

      heading('Next Steps', 4);
      step(
        1,
        'Activate Your CMIT Account',
        'You will receive a separate email containing a link to create your password and activate your account on the CMIT Learning Platform. Once activated, you will be able to log in and access your dashboard.',
      );
      step(
        2,
        'Complete Your Onboarding',
        'After logging in, please watch the onboarding video and familiarise yourself with the platform, including your Dashboard, Courses, Profile, and Support pages.',
      );
      step(
        3,
        'Join the CMIT WhatsApp Community',
        'You will receive an invitation to join the official CMIT WhatsApp Community, where programme announcements, reminders, and cohort discussions will take place. Please join promptly to ensure you receive all important communications.',
      );
      step(
        4,
        'Prepare for Session One',
        'Kindly review all onboarding materials and ensure you have a stable internet connection and access to YouTube before the first session. Weekly session links and programme reminders will be communicated through the WhatsApp community and via email.',
      );

      // ── PAGE 3 — Expectations, contact & signature ──────────────────────
      doc.addPage();
      header();

      heading('Programme Expectations', 4);
      para(
        'To qualify for a Certificate of Completion, participants are expected to:',
      );
      bullet('Attend a minimum of 3 out of the 5 live sessions.');
      bullet('Complete all required assignments within the stated deadlines.');
      bullet('Participate actively throughout the programme.');
      bullet('Observe the guidelines governing the CMIT learning community.');
      doc.moveDown(0.5);
      para(
        'Session recordings will be uploaded to the CMIT Learning Platform within 12 hours after each live session for your continued learning and revision.',
      );
      para(
        'We count it a privilege to welcome you into this pioneering cohort. Our prayer is that these five weeks will deepen your walk with Christ, strengthen your leadership capacity, and equip you to serve faithfully and effectively wherever God has called you.',
      );

      para('For enquiries or technical support, please contact:');
      const contact = (label: string, value: string) => {
        doc
          .font('B')
          .fontSize(10)
          .fillColor(NAVY)
          .text(`${label} `, { continued: true });
        doc.font('R').fillColor(INK).text(value);
      };
      contact('Email:', 'cmithub@gmail.com');
      contact('Phone:', '+234 813 697 1500');
      contact('Website:', 'https://cmithub.org/');
      contact('Instagram:', '@CMITHub');
      doc.moveDown(0.6);

      para(
        'Once again, congratulations on your admission. We look forward to an enriching and transformative experience together.',
      );
      para('Yours faithfully,');
      doc.moveDown(1.4);
      doc.font('B').fontSize(11).fillColor(NAVY).text('Pastor Nonso Orji');
      doc.font('R').fontSize(10).fillColor(MUTED).text('Administration Lead');
      doc.fillColor(MUTED).text('Campus Ministers in Training (CMIT)');

      // Stamp the footer on every page now that the total is known.
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        footer(i + 1, range.count);
      }

      doc.end();
    } catch (e) {
      reject(e as Error);
    }
  });
}

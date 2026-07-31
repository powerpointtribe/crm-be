/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { Module, Injectable } from '@nestjs/common';
import { MongooseModule, InjectModel, InjectConnection } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import {
  EmailTemplate,
  EmailTemplateSchema,
  EmailTemplateDocument,
} from '../../bulk-email/schemas/email-template.schema';
import { EmailProvider } from '../../notifications/providers/email.provider';
import { NotificationsModule } from '../../notifications/notifications.module';
import { Model, Connection } from 'mongoose';

const CMIT_EVENT_ID = '6a231afa313434660f834218';
const FROM = 'CMIT — Campus Ministers in Training <info@cmithub.org>';
const SUBJECT = 'CMIT Partner Update';
const BROCHURE_URL =
  'https://drive.google.com/file/d/1WovJz3KhtoGDq3lfuyuWPgxvox7kxneK/view?usp=share_link';

const BROCHURE_BUTTON_HTML = `
              <!-- Brochure Download -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 8px 0;">
                <tr>
                  <td style="background: #F8F9FD; border-radius: 10px; padding: 22px 28px; text-align: center;" align="center">
                    <div style="font-size: 9px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #18216C; margin-bottom: 10px; font-family: Arial, Helvetica, sans-serif;">Programme Brochure</div>
                    <p style="font-size: 13px; color: #4A4A63; line-height: 1.65; margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif;">Download the official CMIT brochure for a comprehensive overview of the programme, curriculum, and partnership opportunities.</p>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${BROCHURE_URL}" style="height:40px;v-text-anchor:middle;width:220px;" arcsize="15%" fillcolor="#18216C" stroke="f">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.5px;">Download Brochure</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${BROCHURE_URL}" target="_blank" style="display: inline-block; background: #18216C; color: #ffffff; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-decoration: none; padding: 11px 32px; border-radius: 6px; font-family: Arial, Helvetica, sans-serif;">Download Brochure</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
`;

@Injectable()
class BulkEmailSender {
  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
    private emailProvider: EmailProvider,
    @InjectConnection() private connection: Connection,
  ) {}

  async send() {
    // 1. Load template
    const template = await this.emailTemplateModel.findOne({
      slug: 'events.cmit-partner-update',
    });
    if (!template) {
      throw new Error('Template "events.cmit-partner-update" not found in DB');
    }
    console.log('Template loaded. Length:', template.htmlContent.length);

    // 2. Get all CMIT event partners
    const mongoose = await import('mongoose');
    const partners = await this.connection.db!
      .collection('eventpartners')
      .find({
        event: new mongoose.Types.ObjectId(CMIT_EVENT_ID),
      })
      .toArray() as any[];

    console.log(`Found ${partners.length} partners for CMIT event`);

    // 3. Filter: must have both name and email
    const validPartners = partners.filter(
      (p) => p.name?.trim() && p.email?.trim(),
    );
    const skipped = partners.length - validPartners.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} partners without name or email`);
    }

    // 4. Deduplicate by email (lowercase)
    const seen = new Set<string>();
    const uniquePartners: any[] = [];
    for (const p of validPartners) {
      const emailKey = p.email.trim().toLowerCase();
      if (seen.has(emailKey)) {
        console.log(`  DUPLICATE skipped: ${p.name} <${p.email}>`);
        continue;
      }
      seen.add(emailKey);
      uniquePartners.push(p);
    }

    console.log(
      `Sending to ${uniquePartners.length} unique partners (${skipped} skipped, ${validPartners.length - uniquePartners.length} duplicates)`,
    );
    console.log('---');

    // 5. Inject brochure button into template
    // Insert before the Contact Block
    const contactBlockMarker =
      '<!-- Contact Block -->';
    let baseHtml = template.htmlContent;

    if (baseHtml.includes(contactBlockMarker)) {
      baseHtml = baseHtml.replace(
        contactBlockMarker,
        BROCHURE_BUTTON_HTML + '\n              ' + contactBlockMarker,
      );
      console.log('Brochure download button injected into template');
    } else {
      console.warn(
        'WARNING: Could not find Contact Block marker. Brochure button NOT injected.',
      );
    }

    // 6. Send to each partner
    let sent = 0;
    let failed = 0;
    const errors: { name: string; email: string; error: string }[] = [];

    for (let i = 0; i < uniquePartners.length; i++) {
      const partner = uniquePartners[i];
      const name = partner.name.trim();
      const email = partner.email.trim();

      // Personalize
      const html = baseHtml.replace(/\{\{name\}\}/g, name);

      try {
        await this.emailProvider.sendEmail({
          to: email,
          subject: SUBJECT,
          html,
          from: FROM,
        });
        sent++;
        console.log(
          `  [${sent}/${uniquePartners.length}] Sent to: ${name} <${email}>`,
        );
      } catch (error) {
        failed++;
        const errMsg = error?.message || String(error);
        errors.push({ name, email, error: errMsg });
        console.error(
          `  [FAILED] ${name} <${email}>: ${errMsg}`,
        );
      }

      // Rate limit: 1.5s delay between sends
      if (i < uniquePartners.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 7. Summary
    console.log('\n========== SEND COMPLETE ==========');
    console.log(`Total partners:  ${partners.length}`);
    console.log(`Sent:            ${sent}`);
    console.log(`Failed:          ${failed}`);
    console.log(`Skipped (no name/email): ${skipped}`);
    console.log(
      `Skipped (duplicate):     ${validPartners.length - uniquePartners.length}`,
    );

    if (errors.length > 0) {
      console.log('\nFailed sends:');
      errors.forEach((e) =>
        console.log(`  - ${e.name} <${e.email}>: ${e.error}`),
      );
    }

    return { sent, failed, total: uniquePartners.length };
  }

  async dryRun() {
    const mongoose = await import('mongoose');
    const partners = await this.connection.db!
      .collection('eventpartners')
      .find({ event: new mongoose.Types.ObjectId(CMIT_EVENT_ID) })
      .toArray() as any[];

    const valid = partners.filter(
      (p) => p.name?.trim() && p.email?.trim(),
    );
    const seen = new Set<string>();
    const unique = valid.filter((p) => {
      const k = (p.email as string).trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    console.log(`Would send to ${unique.length} partners:\n`);
    unique.forEach((p, i) =>
      console.log(`  ${i + 1}. ${p.name} <${p.email}>`),
    );
    console.log(`\nSubject: ${SUBJECT}`);
    console.log(`From: ${FROM}`);
    console.log(`Brochure: ${BROCHURE_URL}`);
  }
}

@Module({
  imports: [
    AppModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [BulkEmailSender],
})
class BulkEmailModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BulkEmailModule, {
    logger: ['error', 'warn'],
  });

  const sender = app.get(BulkEmailSender);

  // Dry-run flag: pass --dry-run to preview without sending
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('=== DRY RUN MODE — no emails will be sent ===\n');
  }

  try {
    if (isDryRun) {
      const sender = app.get(BulkEmailSender);
      await sender.dryRun();
    } else {
      const result = await sender.send();
      if (result.failed > 0) {
        process.exitCode = 1;
      }
    }

    await app.close();
    process.exit(process.exitCode || 0);
  } catch (error) {
    console.error('Fatal error:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { Module, Injectable } from '@nestjs/common';
import { MongooseModule, InjectModel } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import {
  EmailTemplate,
  EmailTemplateSchema,
  EmailTemplateDocument,
} from '../../bulk-email/schemas/email-template.schema';
import { EmailProvider } from '../../notifications/providers/email.provider';
import { NotificationsModule } from '../../notifications/notifications.module';
import { Model } from 'mongoose';

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

const RECIPIENTS = [
  { name: 'Pastor Olumide Ojeleye', email: 'pstolumideo@gmail.com' },
  { name: 'Michael Okuboyejo', email: 'mykelokuboyejo@gmail.com' },
  { name: 'Pastor Ayomide Onasanya', email: 'ayomideapara@gmail.com' },
  { name: 'Caleb Adebayo', email: 'calebadebayoc@gmail.com' },
];

@Injectable()
class TargetedEmailSender {
  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
    private emailProvider: EmailProvider,
  ) {}

  async send() {
    const template = await this.emailTemplateModel.findOne({
      slug: 'events.cmit-partner-update',
    });
    if (!template) {
      throw new Error('Template not found in DB');
    }

    let baseHtml = template.htmlContent;
    const contactBlockMarker = '<!-- Contact Block -->';
    if (baseHtml.includes(contactBlockMarker)) {
      baseHtml = baseHtml.replace(
        contactBlockMarker,
        BROCHURE_BUTTON_HTML + '\n              ' + contactBlockMarker,
      );
      console.log('Brochure download button injected');
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < RECIPIENTS.length; i++) {
      const { name, email } = RECIPIENTS[i];
      const html = baseHtml.replace(/\{\{name\}\}/g, name);

      try {
        await this.emailProvider.sendEmail({
          to: email,
          subject: SUBJECT,
          html,
          from: FROM,
        });
        sent++;
        console.log(`  [${sent}/${RECIPIENTS.length}] Sent to: ${name} <${email}>`);
      } catch (error) {
        failed++;
        console.error(`  [FAILED] ${name} <${email}>: ${(error as Error).message}`);
      }

      if (i < RECIPIENTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    console.log(`\n========== DONE ==========`);
    console.log(`Sent: ${sent}  |  Failed: ${failed}`);
    return { sent, failed };
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
  providers: [TargetedEmailSender],
})
class TargetedEmailModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(TargetedEmailModule, {
    logger: ['error', 'warn'],
  });

  try {
    const sender = app.get(TargetedEmailSender);
    await sender.send();
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

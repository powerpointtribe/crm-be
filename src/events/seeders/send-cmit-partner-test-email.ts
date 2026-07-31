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

@Injectable()
class TestEmailSender {
  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
    private emailProvider: EmailProvider,
  ) {}

  async send(to: string, name?: string) {
    const template = await this.emailTemplateModel.findOne({
      slug: 'events.cmit-partner-update',
    });

    if (!template) {
      throw new Error('Template not found in DB');
    }

    const testMessageBody = `
      <p class="p">
        Thank you for your partnership with <strong>CMIT — Campus Ministers in Training</strong>.
        This is a test email to confirm the template is working correctly.
      </p>

      <hr class="rule">

      <div class="sec-label">Programme Update</div>

      <p class="p">
        CMIT Cohort 1 is progressing well. We are grateful for your continued support
        and partnership as we train the next generation of campus ministers.
      </p>

      <div class="pull">
        <p>"The harvest truly is plentiful, but the labourers are few." — Matthew 9:37</p>
      </div>

      <p class="p">
        We will keep you updated on key milestones and how your partnership is making
        an impact. If you have any questions, please do not hesitate to reach out.
      </p>
    `;

    let html = template.htmlContent
      .replace(/{{name}}/g, name || 'Partner')
      .replace(/{{messageBody}}/g, testMessageBody)
      .replace(/{{preheader}}/g, 'CMIT Test Email — Verifying partner template')
      .replace(/{{year}}/g, new Date().getFullYear().toString());

    const subject = template.subject.replace(
      /{{subject}}/g,
      'Test Email',
    );

    const from = 'CMIT — Campus Ministers in Training <info@cmithub.org>';

    console.log(`Sending test email to ${to}...`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${from}`);

    await this.emailProvider.sendEmail({
      to,
      subject,
      html,
      from,
    });

    console.log('✅ Test email sent successfully!');
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
  providers: [TestEmailSender],
})
class TestEmailModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(TestEmailModule, {
    logger: ['error', 'warn'],
  });

  const sender = app.get(TestEmailSender);

  const to = process.argv[2] || 'gthankgod@gmail.com';
  const recipientName = process.argv[3] || undefined;

  try {
    await sender.send(to, recipientName);
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

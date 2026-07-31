import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../../bulk-email/schemas/email-template.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as nodemailer from 'nodemailer';

@Injectable()
class JubaEmailTester {
  constructor(
    @InjectModel(EmailTemplate.name) private templateModel: Model<any>,
  ) {}

  async sendTestEmail() {
    const template = await this.templateModel.findOne({
      slug: 'events.juba-2026-welcome',
    });

    if (!template) {
      console.error('❌ Template not found!');
      return;
    }

    console.log(`Found template: ${template.name} (${template._id})`);

    const checkInCode = 'JUBA-001';
    const checkInCodeHtml = checkInCode
      .split('')
      .map(
        (d) =>
          `<td style="width:52px;height:64px;background:#e8d5b7;color:#0a0a0a;font-family:'Courier New',monospace;font-size:28px;font-weight:700;text-align:center;border-radius:10px;">${d}</td>`,
      )
      .join('<td style="width:8px;"></td>');

    const variables: Record<string, string> = {
      firstName: 'ThankGod',
      lastName: 'George',
      email: 'gthankgod+100@gmail.com',
      eventTitle: 'JÚBÀ — A Worship Experience',
      checkInCode,
      checkInCodeHtml,
      formattedDate: 'Saturday, June 27, 2026',
      formattedTime: '5:00 PM',
      locationHtml: `<tr><td style="padding:6px 0;font-size:14px;color:#e8d5b7;width:20px;vertical-align:top;">📍</td><td style="padding:6px 0 6px 8px;font-size:14px;color:#ddd;">The Garrison, Lagos</td></tr>`,
      trackHtml: '',
      year: '2026',
    };

    let html = template.htmlContent;
    let subject = template.subject;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    }

    const configService = new ConfigService();
    const transport = nodemailer.createTransport({
      host: configService.get('ZEPTOMAIL_SMTP_HOST') || 'smtp.zeptomail.com',
      port: parseInt(configService.get('ZEPTOMAIL_SMTP_PORT') || '465'),
      secure: true,
      auth: {
        user: configService.get('ZEPTOMAIL_SMTP_USERNAME') || 'emailapikey',
        pass: configService.get('ZEPTOMAIL_API_KEY'),
      },
    });

    console.log('Sending email...');
    const result = await transport.sendMail({
      from: `"PowerPoint Tribe" <${configService.get('SENDER_EMAIL') || 'info@powerpointtribe.org'}>`,
      to: 'gthankgod+100@gmail.com',
      subject,
      html,
    });

    console.log(`✅ Email sent! MessageId: ${result.messageId}`);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('DATABASE_NAME'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [JubaEmailTester],
})
class TestModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(TestModule, {
    logger: ['error', 'warn', 'log'],
  });

  const tester = app.get(JubaEmailTester);

  try {
    await tester.sendTestEmail();
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

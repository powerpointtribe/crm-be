import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Event, EventSchema } from '../schemas/event.schema';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../../bulk-email/schemas/email-template.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

const JUBA_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to JÚBÀ</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="padding:40px 32px 24px;text-align:center;background:linear-gradient(180deg,#1a1a2e 0%,#16213e 100%);border-radius:16px 16px 0 0;">
  <h1 style="margin:0 0 8px;font-size:36px;font-weight:700;color:#e8d5b7;letter-spacing:3px;">JÚBÀ</h1>
  <p style="margin:0;font-size:14px;color:#b8a088;letter-spacing:2px;text-transform:uppercase;">A Worship Experience</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:36px 32px;background:#141414;">
  <p style="margin:0 0 20px;font-size:18px;color:#f5f0eb;">Hello {{firstName}},</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#c4bdb5;">
    You're officially registered for <strong style="color:#e8d5b7;">{{eventTitle}}</strong>! We're so glad you'll be joining us for an evening set apart to honour God through music, praise, and unified worship.
  </p>

  <!-- Check-in Code -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr><td style="padding:24px;background:#1a1a2e;border-radius:12px;text-align:center;">
    <p style="margin:0 0 12px;font-size:12px;color:#b8a088;letter-spacing:2px;text-transform:uppercase;">Your Check-In Code</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>{{checkInCodeHtml}}</tr>
    </table>
    <p style="margin:12px 0 0;font-size:12px;color:#666;">Present this code at the entrance for quick check-in</p>
  </td></tr>
  </table>

  <!-- Event Details -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr><td style="padding:20px 24px;background:#1c1c1c;border-left:3px solid #e8d5b7;border-radius:0 8px 8px 0;">
    <p style="margin:0 0 4px;font-size:12px;color:#b8a088;letter-spacing:1.5px;text-transform:uppercase;">Event Details</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#e8d5b7;width:20px;vertical-align:top;">📅</td>
      <td style="padding:6px 0 6px 8px;font-size:14px;color:#ddd;">{{formattedDate}}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#e8d5b7;width:20px;vertical-align:top;">🕐</td>
      <td style="padding:6px 0 6px 8px;font-size:14px;color:#ddd;">{{formattedTime}}</td>
    </tr>
    {{locationHtml}}
    {{trackHtml}}
    </table>
  </td></tr>
  </table>

  <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#c4bdb5;">
    This is more than an event — it's a moment to bow in reverence, to pay homage to the One who is worthy. Come with an open heart, ready to encounter God.
  </p>

  <!-- CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 0;">
    <a href="https://juba.powerpointtribe.org" style="display:inline-block;padding:14px 36px;background:#e8d5b7;color:#0a0a0a;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:1px;text-transform:uppercase;">Visit Event Page</a>
  </td></tr>
  </table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:28px 32px;background:#0f0f0f;border-radius:0 0 16px 16px;text-align:center;">
  <p style="margin:0 0 8px;font-size:13px;color:#666;">Hosted by <strong style="color:#999;">PowerPoint Tribe</strong></p>
  <p style="margin:0 0 16px;font-size:12px;color:#555;">The Garrison · 300 Ikorodu-Ososun Rd, Anthony, Lagos</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td style="padding:0 8px;"><a href="https://instagram.com/powerpointtribe" style="font-size:12px;color:#b8a088;text-decoration:none;">Instagram</a></td>
    <td style="color:#333;">·</td>
    <td style="padding:0 8px;"><a href="https://x.com/powerpointtribe" style="font-size:12px;color:#b8a088;text-decoration:none;">Twitter</a></td>
    <td style="color:#333;">·</td>
    <td style="padding:0 8px;"><a href="https://facebook.com/powerpointtribe" style="font-size:12px;color:#b8a088;text-decoration:none;">Facebook</a></td>
  </tr>
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#444;">© {{year}} PowerPoint Tribe. All rights reserved.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

@Injectable()
class JubaTemplateSeeder {
  constructor(
    @InjectModel(EmailTemplate.name) private templateModel: Model<any>,
    @InjectModel(Event.name) private eventModel: Model<any>,
  ) {}

  async seed() {
    // Check if template already exists
    const existing = await this.templateModel.findOne({
      slug: 'events.juba-2026-welcome',
    });

    let template: any;

    if (existing) {
      console.log('Template already exists, updating...');
      existing.htmlContent = JUBA_TEMPLATE_HTML;
      template = await existing.save();
    } else {
      template = await this.templateModel.create({
        name: 'JÚBÀ 2026 — Registration Welcome',
        slug: 'events.juba-2026-welcome',
        subject: "You're Registered for JÚBÀ! 🎶",
        htmlContent: JUBA_TEMPLATE_HTML,
        category: 'event',
        module: 'events',
        isActive: true,
        isSystem: true,
        availableVariables: [
          'firstName',
          'lastName',
          'email',
          'eventTitle',
          'checkInCode',
          'checkInCodeHtml',
          'formattedDate',
          'formattedTime',
          'locationHtml',
          'trackHtml',
          'year',
        ],
        variableDefinitions: [
          { name: 'firstName', description: "Registrant's first name", sampleValue: 'John' },
          { name: 'lastName', description: "Registrant's last name", sampleValue: 'Doe' },
          { name: 'checkInCode', description: 'Check-in code text', sampleValue: 'JUBA-001' },
          { name: 'checkInCodeHtml', description: 'Styled check-in code HTML', sampleValue: '' },
          { name: 'eventTitle', description: 'Event title', sampleValue: 'JÚBÀ — A Worship Experience' },
          { name: 'formattedDate', description: 'Formatted event date', sampleValue: 'Saturday, June 27, 2026' },
          { name: 'formattedTime', description: 'Formatted event time', sampleValue: '5:00 PM' },
        ],
      });
      console.log(`✅ Template created with ID: ${template._id}`);
    }

    // Link template to JUBA event
    const event = await this.eventModel.findOne({ registrationSlug: 'juba-2026' });
    if (!event) {
      console.error('❌ JUBA event not found!');
      return;
    }

    event.registrationSettings.confirmationTemplateId = template._id;
    await event.save();
    console.log(`✅ Template linked to JUBA event (${event._id})`);
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
      { name: Event.name, schema: EventSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [JubaTemplateSeeder],
})
class SeederModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule, {
    logger: ['error', 'warn', 'log'],
  });

  const seeder = app.get(JubaTemplateSeeder);

  try {
    await seeder.seed();
    console.log('✅ Done');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();

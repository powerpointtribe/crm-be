import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from '../schemas/event.schema';
import {
  EmailTemplate,
  EmailTemplateDocument,
} from '../../bulk-email/schemas/email-template.schema';
import { defaultTemplateRegistry } from '../../bulk-email/default-templates';

/**
 * Seeds the CMIT welcome email template into the messaging (bulk-email) module
 * and wires it to the CMIT Cohort 1 event so that every person who registers
 * receives the welcome email.
 *
 * The template content is sourced from the `events.cmit-welcome` definition in
 * src/bulk-email/default-templates/events.defaults.ts (single source of truth),
 * materialised here as an EmailTemplate DB record so the event can reference it
 * by id via registrationSettings.confirmationTemplateId.
 *
 * Run with:    npm run seed:cmit-welcome-template
 * Remove with: npm run seed:cmit-welcome-template:remove
 */
@Injectable()
export class CmitWelcomeTemplateSeeder {
  private readonly logger = new Logger(CmitWelcomeTemplateSeeder.name);
  private readonly templateSlug = 'events.cmit-welcome';
  private readonly eventSlug = 'cmit-cohort-1';
  // CMIT sends from its own domain rather than the platform default. The
  // cmithub.org domain must be a verified sender on the email provider.
  private readonly senderEmail = 'info@cmithub.org';
  private readonly senderName = 'CMIT — Campus Ministers in Training';

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  async seed() {
    this.logger.log('Seeding CMIT welcome email template...');

    const definition = defaultTemplateRegistry[this.templateSlug];
    if (!definition) {
      throw new Error(
        `Template definition "${this.templateSlug}" not found in the default registry`,
      );
    }

    // Upsert the template (global, system-owned) by slug so re-running keeps
    // the DB record in sync with the source-of-truth definition.
    const template = await this.emailTemplateModel.findOneAndUpdate(
      { slug: this.templateSlug },
      {
        $set: {
          name: definition.name,
          slug: definition.slug,
          module: definition.module,
          category: definition.category,
          subject: definition.subject,
          htmlContent: definition.htmlContent,
          variableDefinitions: definition.variableDefinitions,
          availableVariables: definition.variableDefinitions.map((v) => v.name),
          isSystem: true,
          isActive: true,
        },
      },
      { new: true, upsert: true },
    );

    this.logger.log(`✅ Welcome template ready (id: ${template._id})`);

    // Wire it to the CMIT event so registrants receive it on registration.
    const event = await this.eventModel.findOne({
      registrationSlug: this.eventSlug,
    });

    if (!event) {
      this.logger.warn(
        `CMIT event "${this.eventSlug}" not found — template created but not wired. Seed the event first (npm run seed:cmit-cohort-1).`,
      );
      return { template, event: null };
    }

    await this.eventModel.updateOne(
      { _id: event._id },
      {
        $set: {
          'registrationSettings.confirmationTemplateId': template._id,
          'registrationSettings.senderEmail': this.senderEmail,
          'registrationSettings.senderName': this.senderName,
        },
      },
    );

    this.logger.log(
      `✅ Wired welcome template + sender (${this.senderName} <${this.senderEmail}>) to event "${event.title}" (${event._id}). Registrants will now receive the CMIT welcome email.`,
    );

    return { template, event };
  }

  async remove() {
    this.logger.log('Removing CMIT welcome email template wiring...');

    const event = await this.eventModel.findOne({
      registrationSlug: this.eventSlug,
    });
    if (event) {
      await this.eventModel.updateOne(
        { _id: event._id },
        {
          $unset: {
            'registrationSettings.confirmationTemplateId': '',
            'registrationSettings.senderEmail': '',
            'registrationSettings.senderName': '',
          },
        },
      );
      this.logger.log(
        '✅ Unset confirmationTemplateId + custom sender on CMIT event',
      );
    }

    const result = await this.emailTemplateModel.deleteOne({
      slug: this.templateSlug,
    });
    if (result.deletedCount > 0) {
      this.logger.log('✅ CMIT welcome template removed');
    } else {
      this.logger.warn('CMIT welcome template not found');
    }

    return result;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmailTemplate,
  EmailTemplateDocument,
} from '../../bulk-email/schemas/email-template.schema';
import { defaultTemplateRegistry } from '../../bulk-email/default-templates';

/**
 * Seeds the CMIT partner progress-update email template into the
 * EmailTemplate collection so it can be referenced by the bulk partner
 * email feature.
 *
 * The template content is sourced from the `events.cmit-partner-update`
 * definition in src/bulk-email/default-templates/events.defaults.ts.
 *
 * Run with:    npm run seed:cmit-partner-template
 * Remove with: npm run seed:cmit-partner-template:remove
 */
@Injectable()
export class CmitPartnerTemplateSeeder {
  private readonly logger = new Logger(CmitPartnerTemplateSeeder.name);
  private readonly templateSlug = 'events.cmit-partner-update';

  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  async seed() {
    this.logger.log('Seeding CMIT partner update email template...');

    const definition = defaultTemplateRegistry[this.templateSlug];
    if (!definition) {
      throw new Error(
        `Template definition "${this.templateSlug}" not found in the default registry`,
      );
    }

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

    this.logger.log(
      `✅ CMIT partner update template ready (id: ${template._id}, slug: ${template.slug})`,
    );

    return { template };
  }

  async remove() {
    this.logger.log('Removing CMIT partner update email template...');

    const result = await this.emailTemplateModel.deleteOne({
      slug: this.templateSlug,
    });

    if (result.deletedCount > 0) {
      this.logger.log('✅ CMIT partner update template removed');
    } else {
      this.logger.warn('CMIT partner update template not found');
    }

    return result;
  }
}

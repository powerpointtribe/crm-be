import { Module, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MongooseModule, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailTemplate, EmailTemplateSchema, EmailTemplateDocument } from './schemas/email-template.schema';
import { EmailTemplateResolverService } from './email-template-resolver.service';
import { defaultTemplateRegistry } from './default-templates';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [EmailTemplateResolverService],
  exports: [EmailTemplateResolverService, MongooseModule],
})
export class EmailTemplateSharedModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailTemplateSharedModule.name);

  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedSystemTemplates();
  }

  private async seedSystemTemplates() {
    try {
      const existingCount = await this.emailTemplateModel.countDocuments({ isSystem: true });
      if (existingCount > 0) {
        this.logger.log(`System templates already seeded (${existingCount} found). Skipping.`);
        return;
      }

      const templates = Object.values(defaultTemplateRegistry);
      if (!templates.length) return;

      const docs = templates.map((t) => ({
        name: t.name,
        slug: t.slug,
        module: t.module,
        category: t.category,
        subject: t.subject,
        htmlContent: t.htmlContent,
        availableVariables: t.variableDefinitions.map((v) => v.name),
        variableDefinitions: t.variableDefinitions,
        isSystem: true,
        isActive: true,
      }));

      await this.emailTemplateModel.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.code !== 11000) throw err;
        this.logger.warn('Some system templates already exist (duplicate key), skipping those.');
      });

      this.logger.log(`Seeded ${docs.length} system email templates.`);
    } catch (error) {
      this.logger.error('Failed to seed system templates:', error.message);
    }
  }
}

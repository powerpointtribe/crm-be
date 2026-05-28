import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailTemplate, EmailTemplateDocument } from './schemas/email-template.schema';
import { defaultTemplateRegistry, TemplateDefinition } from './default-templates';

interface ResolvedTemplate {
  subject: string;
  html: string;
}

interface CacheEntry {
  template: EmailTemplateDocument | null;
  cachedAt: number;
}

@Injectable()
export class EmailTemplateResolverService {
  private readonly logger = new Logger(EmailTemplateResolverService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectModel(EmailTemplate.name)
    private emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  /**
   * Resolve a template by slug, substitute variables, and return ready-to-send content.
   * Checks branch-specific template first, then global, then falls back to hardcoded default.
   */
  async resolveTemplate(
    slug: string,
    variables: Record<string, string>,
    branchId?: string,
  ): Promise<ResolvedTemplate> {
    // Try to find the template in DB
    const dbTemplate = await this.findTemplateBySlug(slug, branchId);

    if (dbTemplate) {
      return {
        subject: this.substituteVariables(dbTemplate.subject, variables),
        html: this.substituteVariables(dbTemplate.htmlContent, variables),
      };
    }

    // Fall back to hardcoded default
    const defaultTemplate = defaultTemplateRegistry[slug];
    if (defaultTemplate) {
      this.logger.debug(`Using default template for slug: ${slug}`);
      return {
        subject: this.substituteVariables(defaultTemplate.subject, variables),
        html: this.substituteVariables(defaultTemplate.htmlContent, variables),
      };
    }

    // No template found at all — return a minimal fallback
    this.logger.warn(`No template found for slug: ${slug}`);
    return {
      subject: variables.subject || 'Notification',
      html: variables.body || '<p>No template configured.</p>',
    };
  }

  /**
   * Look up template by slug from DB with caching.
   * Checks branch-specific first, then global (branch: null).
   */
  private async findTemplateBySlug(
    slug: string,
    branchId?: string,
  ): Promise<EmailTemplateDocument | null> {
    // Check branch-specific first
    if (branchId) {
      const branchKey = `${slug}:${branchId}`;
      const branchTemplate = await this.getCachedOrFetch(branchKey, {
        slug,
        branch: new Types.ObjectId(branchId),
        isActive: true,
      });
      if (branchTemplate) return branchTemplate;
    }

    // Check global (no branch)
    const globalKey = `${slug}:global`;
    return this.getCachedOrFetch(globalKey, {
      slug,
      branch: { $exists: false } as any,
      isActive: true,
    });
  }

  private async getCachedOrFetch(
    cacheKey: string,
    filter: any,
  ): Promise<EmailTemplateDocument | null> {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.template;
    }

    // Also check for branch: null (not just $exists: false)
    const adjustedFilter = { ...filter };
    if (adjustedFilter.branch?.$exists === false) {
      adjustedFilter.$or = [
        { slug: filter.slug, branch: { $exists: false }, isActive: true },
        { slug: filter.slug, branch: null, isActive: true },
      ];
      delete adjustedFilter.slug;
      delete adjustedFilter.branch;
      delete adjustedFilter.isActive;
    }

    const template = await this.emailTemplateModel
      .findOne(adjustedFilter)
      .exec();

    this.cache.set(cacheKey, { template, cachedAt: Date.now() });
    return template;
  }

  /**
   * Substitute {{variableName}} patterns in content.
   */
  private substituteVariables(
    content: string,
    variables: Record<string, string>,
  ): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
  }

  async resolveTemplateById(
    templateId: string,
    variables: Record<string, string>,
  ): Promise<ResolvedTemplate | null> {
    const cacheKey = `id:${templateId}`;
    const cached = this.cache.get(cacheKey);
    let template: EmailTemplateDocument | null = null;

    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      template = cached.template;
    } else {
      template = await this.emailTemplateModel
        .findOne({ _id: new Types.ObjectId(templateId), isActive: true })
        .exec();
      this.cache.set(cacheKey, { template, cachedAt: Date.now() });
    }

    if (!template) return null;

    return {
      subject: this.substituteVariables(template.subject, variables),
      html: this.substituteVariables(template.htmlContent, variables),
    };
  }

  /**
   * Clear the template cache (e.g., after template updates).
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the default template registry for seeding.
   */
  getDefaultRegistry(): Record<string, TemplateDefinition> {
    return defaultTemplateRegistry;
  }
}

import {
  TemplateCategory,
  TemplateModule,
} from '../schemas/email-template.schema';
import { TemplateDefinition } from './index';

const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

/**
 * Website emails. Staff can override them from the email templates screen
 * (same slug); these are the fallbacks. Every variable is HTML-escaped by the
 * sender before substitution.
 */
export const websiteDefaults: TemplateDefinition[] = [
  {
    slug: 'website.visit-confirmation',
    name: 'Website: plan a visit confirmation',
    module: TemplateModule.FIRST_TIMERS,
    category: TemplateCategory.WELCOME,
    subject: 'See you at {{campusName}}!',
    htmlContent:
      `<div style="font-family: ${font}; background-color: #f4f4f5; padding: 32px 16px;">` +
      `<div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">` +
      `<h2 style="font-size: 20px; color: #111827; margin: 0 0 16px;">We can't wait to meet you, {{firstName}}!</h2>` +
      `<p style="font-size: 15px; color: #374151; line-height: 1.55;">Thanks for planning a visit to <strong>{{campusName}}</strong> on <strong>{{visitDate}}</strong>.</p>` +
      `<p style="font-size: 15px; color: #374151; line-height: 1.55;">{{campusAddress}}</p>` +
      `<p style="font-size: 15px; color: #374151; line-height: 1.55;">Someone from the Tribe will be at the door to welcome you and show you around. If anything changes, just reply to this email.</p>` +
      `<p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">PowerPoint Tribe, one of the many expressions of The Baptizing Church Global</p>` +
      `</div></div>`,
    variableDefinitions: [
      {
        name: 'firstName',
        description: "Visitor's first name",
        sampleValue: 'Ada',
      },
      {
        name: 'campusName',
        description: 'Campus name',
        sampleValue: 'PPT Anthony',
      },
      {
        name: 'visitDate',
        description: 'Planned visit date',
        sampleValue: 'Sunday, 29 November 2026',
      },
      {
        name: 'campusAddress',
        description: 'Campus address (may be empty)',
        sampleValue: '1 Church Road, Lagos',
      },
    ],
  },
];

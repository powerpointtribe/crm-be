import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { EmailTemplateSharedModule } from '../bulk-email/email-template-shared.module';
import { FirstTimersModule } from '../first-timers/first-timers.module';
import {
  FirstTimer,
  FirstTimerSchema,
} from '../first-timers/schemas/first-timer.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { WebsiteFormsController } from './controllers/website-forms.controller';
import { WebsiteInboxController } from './controllers/website-inbox.controller';
import {
  WebFormSubmission,
  WebFormSubmissionSchema,
  WebSubscription,
  WebSubscriptionSchema,
} from './schemas/web-form-submission.schema';
import { WebsiteFormsService } from './services/website-forms.service';
import { WebsiteInboxService } from './services/website-inbox.service';
import { WEBSITE_CONTENT_CONTROLLERS } from './controllers/website-content.controller';
import { WebsitePublicController } from './controllers/website-public.controller';
import { WebsiteSettingsController } from './controllers/website-settings.controller';
import {
  WebDevotional,
  WebDevotionalSchema,
  WebFaq,
  WebFaqSchema,
  WebPastor,
  WebPastorSchema,
  WebSnippet,
  WebSnippetSchema,
  WebTestimony,
  WebTestimonySchema,
} from './schemas/web-content.schema';
import { WebSeries, WebSeriesSchema } from './schemas/web-series.schema';
import { WebSermon, WebSermonSchema } from './schemas/web-sermon.schema';
import {
  WebsiteSettings,
  WebsiteSettingsSchema,
} from './schemas/website-settings.schema';
import { WebContentService } from './services/web-content.service';
import { WebsiteAccessService } from './services/website-access.service';
import { WebsiteSettingsService } from './services/website-settings.service';
import { WebSermonsService } from './services/sermons.service';

export const WEBSITE_MODELS = [
  { name: WebsiteSettings.name, schema: WebsiteSettingsSchema },
  { name: WebSermon.name, schema: WebSermonSchema },
  { name: WebSeries.name, schema: WebSeriesSchema },
  { name: WebDevotional.name, schema: WebDevotionalSchema },
  { name: WebPastor.name, schema: WebPastorSchema },
  { name: WebTestimony.name, schema: WebTestimonySchema },
  { name: WebSnippet.name, schema: WebSnippetSchema },
  { name: WebFaq.name, schema: WebFaqSchema },
  { name: WebFormSubmission.name, schema: WebFormSubmissionSchema },
  { name: WebSubscription.name, schema: WebSubscriptionSchema },
];

/** Content and inbox for the public website (powerpointtribe site). */
@Module({
  imports: [
    RolesModule,
    FirstTimersModule,
    NotificationsModule,
    EmailTemplateSharedModule,
    MongooseModule.forFeature([
      ...WEBSITE_MODELS,
      { name: Branch.name, schema: BranchSchema },
      // Read-only: match an existing first-timer for "plan a visit".
      { name: FirstTimer.name, schema: FirstTimerSchema },
    ]),
  ],
  controllers: [
    WebsitePublicController,
    WebsiteFormsController,
    WebsiteSettingsController,
    WebsiteInboxController,
    ...WEBSITE_CONTENT_CONTROLLERS,
  ],
  providers: [
    WebSermonsService,
    WebContentService,
    WebsiteSettingsService,
    WebsiteAccessService,
    WebsiteFormsService,
    WebsiteInboxService,
  ],
  exports: [
    WebSermonsService,
    WebContentService,
    WebsiteSettingsService,
    WebsiteAccessService,
  ],
})
export class WebsiteModule {}

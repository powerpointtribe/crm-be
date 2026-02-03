import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { EmailTemplate, EmailTemplateSchema } from './schemas/email-template.schema';
import { EmailCampaign, EmailCampaignSchema } from './schemas/email-campaign.schema';
import { EmailSendLog, EmailSendLogSchema } from './schemas/email-send-log.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';

// Services
import { EmailTemplateService } from './email-template.service';
import { EmailCampaignService } from './email-campaign.service';
import { BulkEmailSenderService } from './bulk-email-sender.service';

// Processors - kept here because it depends on BulkEmailSenderService
import { BulkEmailProcessor } from '../queue/processors/bulk-email.processor';

// Controllers
import { EmailTemplateController } from './email-template.controller';
import { EmailCampaignController } from './email-campaign.controller';

// Other modules
import { CommonModule } from '../common/common.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
      { name: EmailCampaign.name, schema: EmailCampaignSchema },
      { name: EmailSendLog.name, schema: EmailSendLogSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    CommonModule,
    RolesModule,
    forwardRef(() => AuditLogsModule),
    QueueModule, // Import QueueModule which exports BullModule with all queues
    NotificationsModule,
  ],
  controllers: [
    EmailTemplateController,
    EmailCampaignController,
  ],
  providers: [
    EmailTemplateService,
    EmailCampaignService,
    BulkEmailSenderService,
    BulkEmailProcessor, // Processor for bulk email campaigns
  ],
  exports: [
    EmailTemplateService,
    EmailCampaignService,
    BulkEmailSenderService,
    MongooseModule,
  ],
})
export class BulkEmailModule {}

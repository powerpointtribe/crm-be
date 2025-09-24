import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailProvider } from './providers/email.provider';

@Module({
  providers: [NotificationsService, EmailProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}

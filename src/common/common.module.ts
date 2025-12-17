import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from './services/access-control.service';
import { PermissionService } from './services/permission.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => AuditLogsModule), forwardRef(() => QueueModule)],
  providers: [AccessControlService, PermissionService, AuditLogInterceptor, AuditInterceptor],
  exports: [AccessControlService, PermissionService, AuditLogInterceptor, AuditInterceptor],
})
export class CommonModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from './services/access-control.service';
import { PermissionService } from './services/permission.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [forwardRef(() => AuditLogsModule)],
  providers: [AccessControlService, PermissionService, AuditLogInterceptor],
  exports: [AccessControlService, PermissionService, AuditLogInterceptor],
})
export class CommonModule {}

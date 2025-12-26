import { Module, forwardRef } from '@nestjs/common';
import { AccessControlService } from './services/access-control.service';
import { PermissionService } from './services/permission.service';
import { BranchAccessService } from './services/branch-access.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import {
  BranchAccessGuard,
  InvitationAccessGuard,
} from './guards/branch-access.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [forwardRef(() => AuditLogsModule), forwardRef(() => QueueModule)],
  providers: [
    AccessControlService,
    PermissionService,
    BranchAccessService,
    AuditLogInterceptor,
    AuditInterceptor,
    BranchAccessGuard,
    InvitationAccessGuard,
  ],
  exports: [
    AccessControlService,
    PermissionService,
    BranchAccessService,
    AuditLogInterceptor,
    AuditInterceptor,
    BranchAccessGuard,
    InvitationAccessGuard,
  ],
})
export class CommonModule {}

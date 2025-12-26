import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { RolesModule } from '../roles/roles.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    forwardRef(() => RolesModule),
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    CommonModule, // Import CommonModule for BranchAccessService
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}

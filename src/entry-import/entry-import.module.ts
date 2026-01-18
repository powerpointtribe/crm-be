import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { EntryImportController } from './entry-import.controller';
import { EntryImportService } from './entry-import.service';
import { EntryImportProcessor } from './entry-import.processor';
import { SuperAdminGuard } from './guards/super-admin.guard';
import {
  EntryImport,
  EntryImportSchema,
  EntryImportItem,
  EntryImportItemSchema,
} from './schemas/entry-import.schema';
import { QueueName } from '../common/interfaces/queue-job.interface';

// Entity handlers
import { FirstTimerHandler } from './handlers/first-timer.handler';
import { MemberHandler } from './handlers/member.handler';
import { MasterMemberHandler } from './handlers/master-member.handler';
import { GroupHandler } from './handlers/group.handler';
import { BranchHandler } from './handlers/branch.handler';
import { ServiceReportHandler } from './handlers/service-report.handler';

// Entity schemas for handlers
import { FirstTimer, FirstTimerSchema } from '../first-timers/schemas/first-timer.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ServiceReport, ServiceReportSchema } from '../service-reports/schemas/service-report.schema';

// Role schema for SuperAdminGuard
import { Role, RoleSchema } from '../roles/schemas/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EntryImport.name, schema: EntryImportSchema },
      { name: EntryImportItem.name, schema: EntryImportItemSchema },
      // Entity schemas for handlers
      { name: FirstTimer.name, schema: FirstTimerSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: ServiceReport.name, schema: ServiceReportSchema },
      // Role schema for SuperAdminGuard
      { name: Role.name, schema: RoleSchema },
    ]),
    BullModule.registerQueue({
      name: QueueName.ENTRY_IMPORT,
    }),
  ],
  controllers: [EntryImportController],
  providers: [
    EntryImportService,
    EntryImportProcessor,
    SuperAdminGuard,
    // Entity handlers
    FirstTimerHandler,
    MemberHandler,
    MasterMemberHandler,
    GroupHandler,
    BranchHandler,
    ServiceReportHandler,
  ],
  exports: [EntryImportService],
})
export class EntryImportModule implements OnModuleInit {
  constructor(
    private readonly entryImportService: EntryImportService,
    private readonly firstTimerHandler: FirstTimerHandler,
    private readonly memberHandler: MemberHandler,
    private readonly masterMemberHandler: MasterMemberHandler,
    private readonly groupHandler: GroupHandler,
    private readonly branchHandler: BranchHandler,
    private readonly serviceReportHandler: ServiceReportHandler,
  ) {}

  onModuleInit() {
    // Register all entity handlers
    this.entryImportService.registerHandler(this.firstTimerHandler);
    this.entryImportService.registerHandler(this.memberHandler);
    this.entryImportService.registerHandler(this.masterMemberHandler);
    this.entryImportService.registerHandler(this.groupHandler);
    this.entryImportService.registerHandler(this.branchHandler);
    this.entryImportService.registerHandler(this.serviceReportHandler);
  }
}

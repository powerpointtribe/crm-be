import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { Group, GroupSchema } from './schemas/group.schema';
import { RolesModule } from '../roles/roles.module';
import { MembersModule } from '../members/members.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
    forwardRef(() => MembersModule), // Import MembersModule for populating members
    RolesModule, // Import RolesModule to make PermissionGuard and UserPermissionsService available
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency
    forwardRef(() => QueueModule), // Import QueueModule for audit logging queue
    CommonModule, // Import CommonModule for BranchAccessService
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}

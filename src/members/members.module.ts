import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { Member, MemberSchema } from './schemas/member.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GroupsModule } from '../groups/groups.module';
import { BranchesModule } from '../branches/branches.module';
import { ActivityTrackerModule } from '../activity-tracker/activity-tracker.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    forwardRef(() => QueueModule),
    forwardRef(() => AuthModule),
    forwardRef(() => GroupsModule), // For bulk import master
    forwardRef(() => BranchesModule), // For branch access
    forwardRef(() => ActivityTrackerModule), // For lifecycle tracking
    CommonModule,
    RolesModule, // Import RolesModule to make PermissionGuard available
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [
    MembersService,
    MongooseModule, // Export MongooseModule so other modules can use the Member model for populate
  ],
})
export class MembersModule {}

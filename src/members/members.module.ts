import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { Member, MemberSchema } from './schemas/member.schema';
import { QueueModule } from '../queue/queue.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
    forwardRef(() => QueueModule),
    forwardRef(() => AuthModule),
    CommonModule,
    RolesModule, // Import RolesModule to make PermissionGuard available
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}

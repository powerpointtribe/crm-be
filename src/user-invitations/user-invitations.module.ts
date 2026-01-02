import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserInvitationsController } from './user-invitations.controller';
import { UserInvitationsService } from './user-invitations.service';
import {
  UserInvitation,
  UserInvitationSchema,
} from './schemas/user-invitation.schema';
import { Member, MemberSchema } from '../members/schemas/member.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { QueueModule } from '../queue/queue.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserInvitation.name, schema: UserInvitationSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    QueueModule,
    RolesModule,
  ],
  controllers: [UserInvitationsController],
  providers: [UserInvitationsService],
  exports: [UserInvitationsService],
})
export class UserInvitationsModule {}

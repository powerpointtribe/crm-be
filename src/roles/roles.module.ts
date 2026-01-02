import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscoveryModule } from '@nestjs/core';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import {
  RoleAssignment,
  RoleAssignmentSchema,
} from './schemas/role-assignment.schema';
import { UserInvitation, UserInvitationSchema } from '../user-invitations/schemas/user-invitation.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';
import { RolesSeederService } from './services/roles-seeder.service';
import { UserPermissionsService } from './services/user-permissions.service';
import { RoleAssignmentService } from './services/role-assignment.service';
import { AutoInitService } from './services/auto-init.service';
import { EndpointDiscoveryService } from './services/endpoint-discovery.service';
import { ModulePermissionsService } from './services/module-permissions.service';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { SeederController } from './seeder.controller';
import { UserPermissionsController } from './user-permissions.controller';
import { RoleAssignmentController } from './role-assignment.controller';
import { PermissionGuard } from './guards/permission.guard';
import { MembersModule } from '../members/members.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
      { name: RoleAssignment.name, schema: RoleAssignmentSchema },
      { name: UserInvitation.name, schema: UserInvitationSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    DiscoveryModule, // For endpoint discovery
    forwardRef(() => MembersModule), // Forward ref to avoid circular dependency
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency with AuditLogsModule
    forwardRef(() => QueueModule), // Import QueueModule for audit logging queue
  ],
  controllers: [
    PermissionsController,
    RolesController,
    SeederController,
    UserPermissionsController,
    RoleAssignmentController,
  ],
  providers: [
    PermissionsService,
    RolesService,
    RolesSeederService,
    UserPermissionsService,
    RoleAssignmentService,
    PermissionGuard,
    AutoInitService,
    EndpointDiscoveryService,
    ModulePermissionsService,
  ],
  exports: [
    PermissionsService,
    RolesService,
    RolesSeederService,
    UserPermissionsService,
    RoleAssignmentService,
    PermissionGuard,
    EndpointDiscoveryService,
    ModulePermissionsService,
    MongooseModule,
  ],
})
export class RolesModule {}

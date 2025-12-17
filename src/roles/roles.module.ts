import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';
import { RolesSeederService } from './services/roles-seeder.service';
import { UserPermissionsService } from './services/user-permissions.service';
import { AutoInitService } from './services/auto-init.service';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { SeederController } from './seeder.controller';
import { UserPermissionsController } from './user-permissions.controller';
import { PermissionGuard } from './guards/permission.guard';
import { MembersModule } from '../members/members.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    forwardRef(() => MembersModule), // Forward ref to avoid circular dependency
    forwardRef(() => AuditLogsModule), // Forward ref to avoid circular dependency with AuditLogsModule
    forwardRef(() => QueueModule), // Import QueueModule for audit logging queue
  ],
  controllers: [
    PermissionsController,
    RolesController,
    SeederController,
    UserPermissionsController,
  ],
  providers: [
    PermissionsService,
    RolesService,
    RolesSeederService,
    UserPermissionsService,
    PermissionGuard,
    AutoInitService,
  ],
  exports: [
    PermissionsService,
    RolesService,
    RolesSeederService,
    UserPermissionsService,
    PermissionGuard,
    MongooseModule,
  ],
})
export class RolesModule {}

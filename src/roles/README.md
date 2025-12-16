# Roles and Permissions Module

A robust, granular roles and permissions system for the Church Management System. This module provides endpoint-level permission control where permissions are tied to specific API endpoints and assigned to roles.

## Features

- **Permission-based access control**: Each endpoint can have a specific permission requirement
- **Role-based assignment**: Permissions are assigned to roles, and roles are assigned to users
- **Centralized permission definitions**: Each module defines its permissions in a dedicated enum file
- **Public endpoint support**: Endpoints can be marked as public (no authentication required)
- **Role hierarchy**: Roles can inherit permissions from parent roles
- **Dynamic role creation**: Admins can create custom roles with specific permissions
- **System roles**: Pre-defined roles that cannot be deleted or modified

## Architecture

### Permission Schema
```typescript
{
  name: string;              // e.g., 'members:create'
  displayName: string;       // e.g., 'Create Member'
  description: string;
  module: string;            // e.g., 'members'
  resource: string;          // e.g., 'member'
  action: string;            // e.g., 'create'
  endpoint: {
    path: string;            // e.g., '/members'
    method: string;          // e.g., 'POST'
  };
  isActive: boolean;
  isPublic: boolean;
}
```

### Role Schema
```typescript
{
  name: string;
  slug: string;
  displayName: string;
  description: string;
  permissions: ObjectId[];   // References to Permission documents
  parentRole?: ObjectId;     // For role inheritance
  level: number;             // Hierarchy level
  isSystemRole: boolean;
  isActive: boolean;
}
```

## Module Permission Enums

Each module has a `permissions/index.ts` file that defines all permissions for that module:

### Example: Members Module
```typescript
// src/members/permissions/index.ts
export enum MembersPermission {
  CREATE_MEMBER = 'members:create',
  VIEW_MEMBERS = 'members:view',
  UPDATE_MEMBER = 'members:update',
  DELETE_MEMBER = 'members:delete',
  // ... more permissions
}

export const MembersPermissionMetadata = {
  [MembersPermission.CREATE_MEMBER]: {
    path: '/members',
    method: 'POST',
    description: 'Create a new member',
  },
  // ... more metadata
};
```

## Usage

### 1. Define Module Permissions

Create a `permissions/index.ts` file in your module:

```typescript
export enum YourModulePermission {
  CREATE_ITEM = 'your-module:create',
  VIEW_ITEMS = 'your-module:view',
  UPDATE_ITEM = 'your-module:update',
  DELETE_ITEM = 'your-module:delete',
}

export const YourModulePermissionMetadata = {
  [YourModulePermission.CREATE_ITEM]: {
    path: '/your-module',
    method: 'POST',
    description: 'Create a new item',
  },
  // ... more
};
```

### 2. Apply Permission Guards to Controllers

Use the `@RequirePermission` decorator on your endpoints:

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { MembersPermission } from './permissions';

@Controller('members')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MembersController {

  @Post()
  @RequirePermission(MembersPermission.CREATE_MEMBER)
  create(@Body() dto: CreateMemberDto) {
    // Only users with 'members:create' permission can access
    return this.membersService.create(dto);
  }

  @Get()
  @RequirePermission(MembersPermission.VIEW_MEMBERS)
  findAll() {
    // Only users with 'members:view' permission can access
    return this.membersService.findAll();
  }
}
```

### 3. Multiple Permission Requirements

```typescript
// Require ANY of the listed permissions
@RequireAnyPermission(
  MembersPermission.VIEW_MEMBERS,
  MembersPermission.VIEW_DISTRICT_MEMBERS
)
findMembers() { }

// Require ALL of the listed permissions
@RequireAllPermissions(
  MembersPermission.UPDATE_MEMBER,
  MembersPermission.UPDATE_MEMBER_ROLES
)
updateMemberRoles() { }
```

### 4. Public Endpoints

For public endpoints, mark them as public in the permission definition:

```typescript
// In permissions/index.ts
export const PUBLIC_ENDPOINTS = [
  'first-timers:register-visitor',
];
```

Or use the existing `@Public()` decorator from auth module.

## Seeding

### Initial Setup

1. **Seed all permissions** from module enum definitions:
```bash
# This will be implemented as a CLI command or startup hook
npm run seed:permissions
```

2. **Seed default system roles**:
```bash
npm run seed:roles
```

3. **Or seed everything**:
```bash
npm run seed:all
```

### Default System Roles

The system comes with pre-defined roles:

- **Super Admin** (level 100): All permissions
- **Admin** (level 90): Most permissions except critical system settings
- **Pastor** (level 80): Pastoral and leadership functions
- **District Pastor** (level 60): District-level permissions
- **Ministry Director** (level 50): Ministry management
- **Unit Head** (level 40): Unit management
- **DC** (level 20): Worker permissions
- **Member** (level 10): Basic member permissions

## API Endpoints

### Permissions

- `GET /permissions` - List all permissions
- `GET /permissions/by-module` - Get permissions grouped by module
- `GET /permissions/:id` - Get permission details
- `POST /permissions` - Create new permission (Admin only)
- `PATCH /permissions/:id` - Update permission (Admin only)
- `DELETE /permissions/:id` - Delete permission (Admin only)

### Roles

- `GET /roles` - List all roles
- `GET /roles/:id` - Get role details
- `GET /roles/:id/permissions` - Get all permissions for a role
- `POST /roles` - Create new role (Admin only)
- `PATCH /roles/:id` - Update role (Admin only)
- `POST /roles/:id/permissions/assign` - Assign permissions to role
- `POST /roles/:id/permissions/add` - Add permissions to role
- `POST /roles/:id/permissions/remove` - Remove permissions from role
- `DELETE /roles/:id` - Delete role (Admin only, not system roles)

## Assigning Roles to Users

Update the Member schema to include role references:

```typescript
// In member.schema.ts
@Prop([{ type: Types.ObjectId, ref: 'Role' }])
roles: Types.ObjectId[];
```

Assign roles to users:

```typescript
member.roles = [roleId1, roleId2];
await member.save();
```

## Migration from Old System

The system maintains backward compatibility with the old `systemRoles` enum field. Users can have both:
- `systemRoles`: Array of UserRole enum values (legacy)
- `roles`: Array of Role document references (new system)

You can gradually migrate users from `systemRoles` to `roles` by creating a migration script.

## Best Practices

1. **One permission per endpoint**: Each endpoint should have exactly one permission requirement
2. **Descriptive permission names**: Use the format `module:action` (e.g., `members:create`)
3. **Centralize permissions**: Always define permissions in the module's `permissions/index.ts`
4. **Document permissions**: Add clear descriptions in the metadata
5. **Use guards consistently**: Always apply both `JwtAuthGuard` and `PermissionGuard`
6. **Test permissions**: Ensure permission checks work as expected

## Security Considerations

- System roles cannot be deleted or modified
- Permission modifications are logged in audit logs
- Always validate user authentication before checking permissions
- Regularly review and audit role assignments
- Use the principle of least privilege when assigning permissions

## Troubleshooting

### User has no roles
If a user has no roles assigned, they will receive a 403 Forbidden error. Ensure all users have at least the "Member" role.

### Permission not found
Make sure the permission is seeded in the database. Run the seeder if needed.

### Endpoint accessible without permission
Check that both `JwtAuthGuard` and `PermissionGuard` are applied to the controller or endpoint.

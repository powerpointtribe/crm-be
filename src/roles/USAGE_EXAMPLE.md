# Quick Usage Guide

## 1. Initial Setup - Seed Permissions and Roles

After starting your application, seed the database with permissions and roles:

**Option A: Via API (Recommended)**
```bash
# Login as a super admin, then:
POST /roles/seeder/all

# Or seed individually:
POST /roles/seeder/permissions
POST /roles/seeder/roles

# Check stats:
GET /roles/seeder/stats
```

**Option B: Create a startup hook in main.ts (Optional)**
```typescript
// In main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Auto-seed on startup (only for development)
  if (process.env.NODE_ENV === 'development') {
    const seeder = app.get(RolesSeederService);
    await seeder.seed();
  }

  await app.listen(3000);
}
```

## 2. Update Existing Controllers

### Before (Old System):
```typescript
@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembersController {

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PASTOR)
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }
}
```

### After (New System):
```typescript
import { PermissionGuard } from '../roles/guards/permission.guard';
import { RequirePermission } from '../roles/decorators/require-permission.decorator';
import { MembersPermission } from './permissions';

@Controller('members')
@UseGuards(JwtAuthGuard, PermissionGuard) // Changed guard
export class MembersController {

  @Post()
  @RequirePermission(MembersPermission.CREATE_MEMBER) // Use permission
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }

  @Get()
  @RequirePermission(MembersPermission.VIEW_MEMBERS)
  findAll() {
    return this.membersService.findAll();
  }
}
```

## 3. Assign Roles to Users

```typescript
// Find the role
const memberRole = await rolesService.findBySlug('member');

// Assign to user
member.roles = [memberRole._id];
await member.save();

// Or assign multiple roles
const adminRole = await rolesService.findBySlug('admin');
const pastorRole = await rolesService.findBySlug('pastor');
member.roles = [adminRole._id, pastorRole._id];
await member.save();
```

## 4. Create Custom Roles

```typescript
// Via API
POST /roles
{
  "name": "Youth Leader",
  "displayName": "Youth Ministry Leader",
  "description": "Leader of youth ministry",
  "level": 45,
  "permissions": ["<permission-id-1>", "<permission-id-2>"]
}

// Or via service
const permissions = await permissionsService.findAll({ module: 'ministries' });
const permissionIds = permissions.map(p => p._id);

await rolesService.create({
  name: 'Youth Leader',
  displayName: 'Youth Ministry Leader',
  description: 'Leader of youth ministry',
  level: 45,
  permissions: permissionIds.map(id => id.toString())
});
```

## 5. Add Permissions to Existing Role

```typescript
POST /roles/:roleId/permissions/add
{
  "permissionIds": ["<permission-id-1>", "<permission-id-2>"]
}
```

## Key Endpoints

- **Seed**: `POST /roles/seeder/all`
- **List Roles**: `GET /roles`
- **List Permissions**: `GET /permissions`
- **Permissions by Module**: `GET /permissions/by-module`
- **Create Role**: `POST /roles`
- **Assign Permissions**: `POST /roles/:id/permissions/assign`

# Audit Logging Implementation Guide

## Overview

Automatic audit logging has been implemented for all Create, Update, and Delete (CUD) operations in the system. The audit logs capture:

- **Who** performed the action (user details, email, roles)
- **What** action was performed (CREATE, UPDATE, DELETE, etc.)
- **When** the action occurred (timestamp)
- **Which** entity was affected (entity type and ID)
- **Details** about the change (old values vs new values for updates)
- **Additional metadata** (IP address, user agent, request details)

## Files Created

### 1. Audit Log Decorator
**File:** `src/common/decorators/audit-log.decorator.ts`

This decorator is used to mark controller methods that should be audited.

### 2. Audit Log Interceptor
**File:** `src/common/interceptors/audit-log.interceptor.ts`

This interceptor automatically captures request/response data and creates audit log entries.

## How It Works

1. The `@AuditLog()` decorator is applied to controller methods
2. The `AuditLogInterceptor` intercepts the request
3. For UPDATE operations, it captures the old values before execution
4. After the operation completes, it captures the new values
5. An audit log entry is created with all relevant information
6. The audit log is stored in the `audit_logs` collection

## Implementation Example

The Members controller has been updated as a reference implementation:

```typescript
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@Controller('members')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)  // Add interceptor at controller level
export class MembersController {

  // CREATE operation
  @Post()
  @RequirePermission(MembersPermission.CREATE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_CREATED,
    entityType: AuditEntity.MEMBER,
    description: 'Created a new member',
    getEntityId: (result) => result._id.toString(),
  })
  async create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  // UPDATE operation
  @Patch(':id')
  @RequirePermission(MembersPermission.UPDATE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_UPDATED,
    entityType: AuditEntity.MEMBER,
    description: 'Updated member information',
    getEntityId: (result, request) => request.params.id,
  })
  async update(@Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(id, updateMemberDto);
  }

  // DELETE operation
  @Delete(':id')
  @RequirePermission(MembersPermission.DELETE_MEMBER)
  @AuditLog({
    action: AuditAction.MEMBER_DELETED,
    entityType: AuditEntity.MEMBER,
    description: 'Deleted a member',
    severity: 'high',
    getEntityId: (result, request) => request.params.id,
  })
  async remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }
}
```

## Applying Audit Logging to Other Controllers

Follow these steps for each controller:

### Step 1: Add Imports

Add these imports at the top of your controller file:

```typescript
import { UseInterceptors } from '@nestjs/common';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
```

### Step 2: Add Interceptor to Controller

Add the interceptor decorator to your controller class:

```typescript
@Controller('your-resource')
@UseGuards(JwtAuthGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)  // Add this line
export class YourController {
  // ...
}
```

### Step 3: Add Decorator to Methods

Add the `@AuditLog()` decorator to each CREATE, UPDATE, and DELETE method.

## Controllers That Need Audit Logging

Apply audit logging to these controllers:

### High Priority (Core Entities) - ✅ ALL COMPLETED
- ✅ **Members Controller** - Fully implemented (CREATE, UPDATE, DELETE)
- ✅ **Groups Controller** - Fully implemented (CREATE, UPDATE, DELETE, ADD_MEMBER, REMOVE_MEMBER)
- ✅ **First Timers Controller** - Fully implemented (CREATE, UPDATE, DELETE)
- ✅ **Inventory Controller** - Fully implemented (CREATE, UPDATE, DELETE)
- ✅ **Roles Controller** - Fully implemented (CREATE, UPDATE, DELETE)

### Medium Priority
- ⬜ **Attendance Controller**
- ⬜ **Ministries Controller**
- ⬜ **Units Controller**
- ⬜ **Service Reports Controller**

### Examples for Each Entity Type

#### Groups/Units Controller

```typescript
@Post()
@AuditLog({
  action: AuditAction.GROUP_CREATED,
  entityType: AuditEntity.GROUP,
  description: 'Created a new group',
  getEntityId: (result) => result._id.toString(),
})
async create(@Body() createGroupDto: CreateGroupDto) {
  return this.groupsService.create(createGroupDto);
}

@Patch(':id')
@AuditLog({
  action: AuditAction.GROUP_UPDATED,
  entityType: AuditEntity.GROUP,
  description: 'Updated group information',
  getEntityId: (result, request) => request.params.id,
})
async update(@Param('id') id: string, @Body() updateGroupDto: UpdateGroupDto) {
  return this.groupsService.update(id, updateGroupDto);
}
```

#### First Timers Controller

```typescript
@Post()
@AuditLog({
  action: AuditAction.CREATE,
  entityType: AuditEntity.FIRST_TIMER,
  description: 'Created a new first timer record',
  getEntityId: (result) => result._id.toString(),
})
async create(@Body() createFirstTimerDto: CreateFirstTimerDto) {
  return this.firstTimersService.create(createFirstTimerDto);
}
```

#### Inventory Controller

```typescript
@Post()
@AuditLog({
  action: AuditAction.INVENTORY_ITEM_CREATED,
  entityType: AuditEntity.INVENTORY_ITEM,
  description: 'Created a new inventory item',
  getEntityId: (result) => result._id.toString(),
})
async create(@Body() createInventoryDto: CreateInventoryDto) {
  return this.inventoryService.create(createInventoryDto);
}

@Patch(':id/stock/add')
@AuditLog({
  action: AuditAction.INVENTORY_STOCK_ADDED,
  entityType: AuditEntity.INVENTORY_ITEM,
  description: 'Added stock to inventory item',
  severity: 'medium',
  getEntityId: (result, request) => request.params.id,
})
async addStock(@Param('id') id: string, @Body() addStockDto: AddStockDto) {
  return this.inventoryService.addStock(id, addStockDto);
}
```

## Available Audit Actions

From `src/common/enums/audit-action.enum.ts`:

```typescript
// General actions
CREATE, UPDATE, DELETE, VIEW, EXPORT

// Authentication
LOGIN, LOGOUT, PASSWORD_RESET

// Members
MEMBER_CREATED, MEMBER_UPDATED, MEMBER_DELETED, MEMBER_STATUS_CHANGED

// Inventory
INVENTORY_ITEM_CREATED, INVENTORY_ITEM_UPDATED, INVENTORY_ITEM_DELETED
INVENTORY_STOCK_ADDED, INVENTORY_STOCK_REMOVED, INVENTORY_ITEM_TRANSFERRED

// Groups/Units
GROUP_CREATED, GROUP_UPDATED, GROUP_MEMBER_ADDED, GROUP_MEMBER_REMOVED

// Reports
REPORT_GENERATED, REPORT_DOWNLOADED

// Bulk operations
BULK_IMPORT, BULK_UPDATE, BULK_DELETE
```

## Available Entity Types

From `src/common/enums/audit-action.enum.ts`:

```typescript
MEMBER, GROUP, INVENTORY_ITEM, INVENTORY_CATEGORY, UNIT, MINISTRY,
SERVICE_REPORT, FIRST_TIMER, ATTENDANCE, USER, SYSTEM
```

## Decorator Options

The `@AuditLog()` decorator accepts these options:

```typescript
{
  action: AuditAction;              // Required: The action being performed
  entityType: AuditEntity;          // Required: The type of entity
  description?: string;             // Optional: Custom description
  severity?: 'low' | 'medium' | 'high' | 'critical';  // Optional: Severity level
  getEntityId?: (result, request) => string;  // Optional: Custom entity ID extractor
}
```

### Entity ID Extraction

- **For CREATE operations**: Use `getEntityId: (result) => result._id.toString()`
- **For UPDATE/DELETE operations**: Use `getEntityId: (result, request) => request.params.id`

## What Gets Logged

Each audit log entry contains:

```typescript
{
  action: 'MEMBER_UPDATED',
  entityType: 'MEMBER',
  entityId: '507f1f77bcf86cd799439011',
  performedBy: ObjectId('507f191e810c19729de860ea'),
  performedByName: 'John Doe',
  performedByEmail: 'john@church.com',
  performedByRoles: ['ADMIN'],
  description: 'Updated member information',
  oldValues: {
    firstName: 'John',
    phone: '123456789'
  },
  newValues: {
    firstName: 'Jonathan',
    phone: '987654321'
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    source: 'web',
    method: 'PATCH',
    url: '/members/507f1f77bcf86cd799439011',
    params: { id: '507f1f77bcf86cd799439011' }
  },
  severity: 'medium',
  timestamp: ISODate('2025-12-08T10:30:00.000Z'),
  createdAt: ISODate('2025-12-08T10:30:00.000Z')
}
```

## Security Features

1. **Automatic Redaction**: Sensitive fields like passwords, tokens, and secrets are automatically redacted
2. **Circular Reference Protection**: The interceptor handles circular references in objects
3. **Retry Logic**: Failed audit logs are retried up to 3 times
4. **Fallback Logging**: If primary logging fails, a fallback mechanism creates a simplified log

## Viewing Audit Logs

Audit logs can be viewed through:

1. **API Endpoint**: `GET /audit-logs` (with query filters)
2. **Statistics**: `GET /audit-logs/statistics`
3. **Export**: `GET /audit-logs/export?format=csv` or `format=json`

Query parameters:
- `page`, `limit` - Pagination
- `startDate`, `endDate` - Date range filtering
- `action` - Filter by action type
- `entityType` - Filter by entity type
- `performedBy` - Filter by user
- `severity` - Filter by severity level

## Next Steps

1. Apply the `@AuditLog()` decorator to all CREATE, UPDATE, and DELETE methods across all controllers
2. Ensure the `@UseInterceptors(AuditLogInterceptor)` is added to each controller class
3. Test each controller to verify audit logs are being created
4. Review audit logs regularly for security and compliance
5. Set up automated cleanup of old audit logs (retention policy)

## Testing

To test audit logging:

1. Perform a CREATE/UPDATE/DELETE operation through the API
2. Check the MongoDB `audit_logs` collection
3. Verify all required fields are populated
4. For updates, verify `oldValues` and `newValues` are captured
5. Check that sensitive data is redacted

## Troubleshooting

If audit logs are not being created:

1. Check that the interceptor is added to the controller
2. Verify the decorator is applied to the method
3. Ensure the user is authenticated (request.user exists)
4. Check backend logs for any errors
5. Verify the AuditLogsService is properly injected

## Performance Considerations

- Audit logging is asynchronous and doesn't block the main request
- Failed audit logs are retried with exponential backoff
- The system uses MongoDB indexes for efficient querying
- Consider archiving old audit logs to maintain performance

---

## Implementation Summary

✅ **ALL HIGH-PRIORITY CONTROLLERS COMPLETED**

### Fully Implemented Controllers:
1. **Members Controller** (`src/members/members.controller.ts`)
   - CREATE: Member creation
   - UPDATE: Member information updates
   - DELETE: Member deletion

2. **Groups Controller** (`src/groups/groups.controller.ts`)
   - CREATE: Group/district/unit creation
   - UPDATE: Group information updates
   - DELETE: Group deletion
   - ADD_MEMBER: Adding members to groups
   - REMOVE_MEMBER: Removing members from groups

3. **First Timers Controller** (`src/first-timers/first-timers.controller.ts`)
   - CREATE: First-timer registration
   - UPDATE: First-timer information updates
   - DELETE: First-timer record deletion

4. **Inventory Controller** (`src/inventory/inventory-item.controller.ts`)
   - Already had audit logging implemented with `@Audit` decorator
   - CREATE, UPDATE, DELETE operations all logged

5. **Roles Controller** (`src/roles/roles.controller.ts`)
   - CREATE: Role creation
   - UPDATE: Role updates
   - DELETE: Role deletion

### What's Being Logged:
- **User Information**: Name, email, roles
- **Action Type**: CREATE, UPDATE, DELETE, etc.
- **Entity Details**: Type and ID of affected entity
- **Change Details**: Old values vs new values for updates
- **Metadata**: IP address, user agent, timestamp, severity
- **Security**: Sensitive data (passwords, tokens) automatically redacted

---

**Status**: ✅ Audit logging fully implemented and deployed
**Build Status**: ✅ All changes compiled successfully
**Next Steps**: Monitor audit logs and consider implementing for medium-priority controllers if needed

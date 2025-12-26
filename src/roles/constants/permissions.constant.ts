import {
  MembersPermission,
  MembersPermissionMetadata,
} from '../../members/permissions';
import {
  MinistriesPermission,
  MinistriesPermissionMetadata,
} from '../../ministries/permissions';
import {
  UnitsPermission,
  UnitsPermissionMetadata,
} from '../../units/permissions';
import {
  FirstTimersPermission,
  FirstTimersPermissionMetadata,
} from '../../first-timers/permissions';
import {
  AttendancePermission,
  AttendancePermissionMetadata,
} from '../../attendance/permissions';
import {
  GroupsPermission,
  GroupsPermissionMetadata,
} from '../../groups/permissions';
import {
  InventoryPermission,
  InventoryPermissionMetadata,
} from '../../inventory/permissions';
import {
  ServiceReportsPermission,
  ServiceReportsPermissionMetadata,
} from '../../service-reports/permissions';
import {
  DashboardPermission,
  DashboardPermissionMetadata,
} from '../../dashboard/permissions';
import {
  WorkersTrainingPermission,
  WorkersTrainingPermissionMetadata,
} from '../../workers-training/permissions';
import {
  ActivityTrackerPermission,
  ActivityTrackerPermissionMetadata,
} from '../../activity-tracker/permissions';
import {
  RolesModulePermission,
  RolesModulePermissionMetadata,
} from '../permissions';
import {
  AuditLogsPermission,
  AuditLogsPermissionMetadata,
} from '../../audit-logs/permissions';
import {
  BulkOperationsPermission,
  BulkOperationsPermissionMetadata,
} from '../../bulk-operations/permissions';
import {
  QueuePermission,
  QueuePermissionMetadata,
} from '../../queue/permissions';
import {
  UserManagementPermission,
  UserManagementPermissionMetadata,
} from '../../user-invitations/permissions';
import {
  BranchesPermission,
  BranchesPermissionMetadata,
} from '../../branches/permissions';
import { CreatePermissionDto } from '../dto/create-permission.dto';

/**
 * Convert permission enum and metadata to CreatePermissionDto
 */
function createPermissionDto(
  permissionName: string,
  metadata: any,
  module: string,
): CreatePermissionDto {
  const [resource, action] = permissionName.split(':');

  const dto: CreatePermissionDto = {
    name: permissionName,
    displayName:
      metadata.description ||
      permissionName.replace(/:/g, ' ').replace(/-/g, ' '),
    description: metadata.description,
    module,
    resource,
    action,
    isActive: true,
    isPublic: false,
  };

  // Only include endpoint if both path and method are defined
  if (metadata.path && metadata.method) {
    dto.endpoint = {
      path: metadata.path,
      method: metadata.method,
    };
  }

  return dto;
}

/**
 * All permissions from all modules
 */
export const ALL_PERMISSIONS: CreatePermissionDto[] = [
  // Members Module
  ...Object.values(MembersPermission).map((perm) =>
    createPermissionDto(
      perm,
      MembersPermissionMetadata[perm] || {},
      'members',
    ),
  ),

  // Ministries Module
  ...Object.values(MinistriesPermission).map((perm) =>
    createPermissionDto(
      perm,
      MinistriesPermissionMetadata[perm] || {},
      'ministries',
    ),
  ),

  // Units Module
  ...Object.values(UnitsPermission).map((perm) =>
    createPermissionDto(perm, UnitsPermissionMetadata[perm] || {}, 'units'),
  ),

  // First Timers Module
  ...Object.values(FirstTimersPermission).map((perm) =>
    createPermissionDto(
      perm,
      FirstTimersPermissionMetadata[perm] || {},
      'first-timers',
    ),
  ),

  // Attendance Module
  ...Object.values(AttendancePermission).map((perm) =>
    createPermissionDto(
      perm,
      AttendancePermissionMetadata[perm] || {},
      'attendance',
    ),
  ),

  // Groups Module
  ...Object.values(GroupsPermission).map((perm) =>
    createPermissionDto(perm, GroupsPermissionMetadata[perm] || {}, 'groups'),
  ),

  // Inventory Module
  ...Object.values(InventoryPermission).map((perm) =>
    createPermissionDto(
      perm,
      InventoryPermissionMetadata[perm] || {},
      'inventory',
    ),
  ),

  // Service Reports Module
  ...Object.values(ServiceReportsPermission).map((perm) =>
    createPermissionDto(
      perm,
      ServiceReportsPermissionMetadata[perm] || {},
      'service-reports',
    ),
  ),

  // Dashboard Module
  ...Object.values(DashboardPermission).map((perm) =>
    createPermissionDto(
      perm,
      DashboardPermissionMetadata[perm] || {},
      'dashboard',
    ),
  ),

  // Workers Training Module
  ...Object.values(WorkersTrainingPermission).map((perm) =>
    createPermissionDto(
      perm,
      WorkersTrainingPermissionMetadata[perm] || {},
      'workers-training',
    ),
  ),

  // Activity Tracker Module
  ...Object.values(ActivityTrackerPermission).map((perm) =>
    createPermissionDto(
      perm,
      ActivityTrackerPermissionMetadata[perm] || {},
      'activity-tracker',
    ),
  ),

  // Roles Module
  ...Object.values(RolesModulePermission).map((perm) =>
    createPermissionDto(
      perm,
      RolesModulePermissionMetadata[perm] || {},
      'roles',
    ),
  ),

  // Audit Logs Module
  ...Object.values(AuditLogsPermission).map((perm) =>
    createPermissionDto(
      perm,
      AuditLogsPermissionMetadata[perm] || {},
      'audit-logs',
    ),
  ),

  // Bulk Operations Module
  ...Object.values(BulkOperationsPermission).map((perm) =>
    createPermissionDto(
      perm,
      BulkOperationsPermissionMetadata[perm] || {},
      'bulk-operations',
    ),
  ),

  // Queue Module
  ...Object.values(QueuePermission).map((perm) =>
    createPermissionDto(perm, QueuePermissionMetadata[perm] || {}, 'queue'),
  ),

  // User Management Module
  ...Object.values(UserManagementPermission).map((perm) =>
    createPermissionDto(
      perm,
      UserManagementPermissionMetadata[perm] || {},
      'user-management',
    ),
  ),

  // Branches Module
  ...Object.values(BranchesPermission).map((perm) =>
    createPermissionDto(
      perm,
      BranchesPermissionMetadata[perm] || {},
      'branches',
    ),
  ),
];

/**
 * Public endpoints that don't require authentication
 * These endpoints can be accessed without a valid JWT token
 */
export const PUBLIC_ENDPOINTS = [
  // Auth endpoints
  'auth:login',
  'auth:register',
  'auth:forgot-password',
  'auth:verify-otp',
  'auth:reset-password',

  // First-timers public endpoints
  'first-timers:public-form-config',
  'first-timers:register-visitor',

  // Upload endpoints (public image upload for first-timers)
  'upload:image',
];

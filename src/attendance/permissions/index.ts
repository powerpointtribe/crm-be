/**
 * Attendance Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum AttendancePermission {
  // CREATE operations
  CREATE_ATTENDANCE = 'attendance:create',
  RECORD_ATTENDANCE = 'attendance:record',
  MARK_SELF_ATTENDANCE = 'attendance:mark-self',

  // READ operations
  VIEW_ATTENDANCE = 'attendance:view',
  VIEW_ATTENDANCE_DETAILS = 'attendance:view-details',
  VIEW_ATTENDANCE_STATS = 'attendance:view-stats',
  VIEW_OWN_ATTENDANCE = 'attendance:view-own',
  VIEW_DISTRICT_ATTENDANCE = 'attendance:view-district',
  VIEW_UNIT_ATTENDANCE = 'attendance:view-unit',
  EXPORT_ATTENDANCE = 'attendance:export',

  // UPDATE operations
  UPDATE_ATTENDANCE = 'attendance:update',
  APPROVE_ATTENDANCE = 'attendance:approve',

  // DELETE operations
  DELETE_ATTENDANCE = 'attendance:delete',

  // SPECIAL operations
  GENERATE_ATTENDANCE_REPORT = 'attendance:generate-report',
  VIEW_ATTENDANCE_TRENDS = 'attendance:view-trends',
}

export const AttendancePermissionMetadata = {
  [AttendancePermission.CREATE_ATTENDANCE]: {
    path: '/attendance',
    method: 'POST',
    description: 'Create attendance record',
  },
  [AttendancePermission.VIEW_ATTENDANCE]: {
    path: '/attendance',
    method: 'GET',
    description: 'View attendance records',
  },
  [AttendancePermission.VIEW_ATTENDANCE_STATS]: {
    path: '/attendance/stats',
    method: 'GET',
    description: 'View attendance statistics',
  },
  [AttendancePermission.UPDATE_ATTENDANCE]: {
    path: '/attendance/:id',
    method: 'PATCH',
    description: 'Update attendance record',
  },
  [AttendancePermission.DELETE_ATTENDANCE]: {
    path: '/attendance/:id',
    method: 'DELETE',
    description: 'Delete attendance record',
  },
};

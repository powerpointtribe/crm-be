export enum ServiceAttendancePermission {
  RECORD = 'attendance:record',
  VIEW = 'attendance:view',
  VIEW_STATS = 'attendance:view-stats',
  VIEW_MEMBER_HISTORY = 'attendance:view-member-history',
  BULK_RECORD = 'attendance:bulk-record',
  UPDATE = 'attendance:update',
  DELETE = 'attendance:delete',
}

export const ServiceAttendancePermissionMetadata = {
  [ServiceAttendancePermission.RECORD]: {
    path: '/service-attendance',
    method: 'POST',
    description: 'Record individual attendance',
  },
  [ServiceAttendancePermission.VIEW]: {
    path: '/service-attendance',
    method: 'GET',
    description: 'View attendance records',
  },
  [ServiceAttendancePermission.VIEW_STATS]: {
    path: '/service-attendance/stats',
    method: 'GET',
    description: 'View attendance statistics',
  },
  [ServiceAttendancePermission.VIEW_MEMBER_HISTORY]: {
    path: '/service-attendance/member/:memberId',
    method: 'GET',
    description: 'View attendance history for a member',
  },
  [ServiceAttendancePermission.BULK_RECORD]: {
    path: '/service-attendance/bulk',
    method: 'POST',
    description: 'Record attendance for multiple members at once',
  },
  [ServiceAttendancePermission.UPDATE]: {
    path: '/service-attendance/:id',
    method: 'PATCH',
    description: 'Update an attendance record',
  },
  [ServiceAttendancePermission.DELETE]: {
    path: '/service-attendance/:id',
    method: 'DELETE',
    description: 'Delete an attendance record',
  },
};

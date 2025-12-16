/**
 * Activity Tracker Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum ActivityTrackerPermission {
  // CREATE operations
  CREATE_ACTIVITY = 'activity-tracker:create',
  LOG_MEMBER_REGISTRATION = 'activity-tracker:log-registration',
  LOG_BAPTISM = 'activity-tracker:log-baptism',
  LOG_SPECIAL_EVENT = 'activity-tracker:log-special-event',

  // READ operations
  VIEW_ACTIVITIES = 'activity-tracker:view',
  VIEW_ACTIVITY_DETAILS = 'activity-tracker:view-details',
  VIEW_ACTIVITY_STATS = 'activity-tracker:view-stats',
  VIEW_UPCOMING_FOLLOWUPS = 'activity-tracker:view-upcoming-followups',
  VIEW_MEMBER_TIMELINE = 'activity-tracker:view-member-timeline',
  VIEW_MEMBER_STATS = 'activity-tracker:view-member-stats',

  // UPDATE operations
  UPDATE_ACTIVITY = 'activity-tracker:update',
  ADD_FOLLOWUP_NOTE = 'activity-tracker:add-followup-note',
  MARK_ACTIVITY_COMPLETE = 'activity-tracker:mark-complete',

  // DELETE operations
  DELETE_ACTIVITY = 'activity-tracker:delete',
}

export const ActivityTrackerPermissionMetadata = {
  [ActivityTrackerPermission.CREATE_ACTIVITY]: {
    path: '/activity-tracker',
    method: 'POST',
    description: 'Create a new activity',
  },
  [ActivityTrackerPermission.VIEW_ACTIVITIES]: {
    path: '/activity-tracker',
    method: 'GET',
    description: 'View all activities',
  },
  [ActivityTrackerPermission.VIEW_ACTIVITY_DETAILS]: {
    path: '/activity-tracker/:id',
    method: 'GET',
    description: 'View specific activity details',
  },
  [ActivityTrackerPermission.UPDATE_ACTIVITY]: {
    path: '/activity-tracker/:id',
    method: 'PATCH',
    description: 'Update activity information',
  },
  [ActivityTrackerPermission.DELETE_ACTIVITY]: {
    path: '/activity-tracker/:id',
    method: 'DELETE',
    description: 'Delete an activity',
  },
};

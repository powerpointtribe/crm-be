/**
 * Events Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum EventsPermission {
  // Event CRUD operations
  CREATE_EVENT = 'events:create',
  VIEW_EVENTS = 'events:view',
  VIEW_EVENT_DETAILS = 'events:view-details',
  UPDATE_EVENT = 'events:update',
  DELETE_EVENT = 'events:delete',

  // Committee management
  MANAGE_COMMITTEE = 'events:manage-committee',

  // Registration management
  VIEW_REGISTRATIONS = 'events:view-registrations',
  CREATE_REGISTRATION = 'events:create-registration',
  UPDATE_REGISTRATION = 'events:update-registration',
  CHECK_IN = 'events:check-in',
  EXPORT_REGISTRATIONS = 'events:export',
}

/**
 * Permission metadata for endpoint mapping
 */
export const EventsPermissionMetadata = {
  [EventsPermission.CREATE_EVENT]: {
    path: '/events',
    method: 'POST',
    description: 'Create a new event',
  },
  [EventsPermission.VIEW_EVENTS]: {
    path: '/events',
    method: 'GET',
    description: 'View all events',
  },
  [EventsPermission.VIEW_EVENT_DETAILS]: {
    path: '/events/:id',
    method: 'GET',
    description: 'View specific event details',
  },
  [EventsPermission.UPDATE_EVENT]: {
    path: '/events/:id',
    method: 'PATCH',
    description: 'Update event information',
  },
  [EventsPermission.DELETE_EVENT]: {
    path: '/events/:id',
    method: 'DELETE',
    description: 'Delete an event',
  },
  [EventsPermission.MANAGE_COMMITTEE]: {
    path: '/events/:id/committee',
    method: 'POST',
    description: 'Manage event committee members',
  },
  [EventsPermission.VIEW_REGISTRATIONS]: {
    path: '/events/:id/registrations',
    method: 'GET',
    description: 'View event registrations',
  },
  [EventsPermission.CREATE_REGISTRATION]: {
    path: '/events/:id/registrations',
    method: 'POST',
    description: 'Create a registration for an event',
  },
  [EventsPermission.UPDATE_REGISTRATION]: {
    path: '/events/:id/registrations/:regId',
    method: 'PATCH',
    description: 'Update registration status',
  },
  [EventsPermission.CHECK_IN]: {
    path: '/events/:id/registrations/:regId/check-in',
    method: 'PATCH',
    description: 'Check in an attendee',
  },
  [EventsPermission.EXPORT_REGISTRATIONS]: {
    path: '/events/:id/registrations/export',
    method: 'GET',
    description: 'Export event registrations',
  },
};

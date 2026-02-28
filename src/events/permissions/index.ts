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
  MANAGE_REGISTRATIONS = 'events:manage-registrations',
  CHECK_IN = 'events:check-in',
  EXPORT_REGISTRATIONS = 'events:export',

  // Partnership management
  VIEW_PARTNERS = 'events:view-partners',
  MANAGE_PARTNERS = 'events:manage-partners',

  // Email management
  SEND_EMAILS = 'events:send-emails',
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
  [EventsPermission.MANAGE_REGISTRATIONS]: {
    path: '/events/:id/admin/registrations',
    method: 'PATCH',
    description: 'Manage event registrations (admin)',
  },
  [EventsPermission.VIEW_PARTNERS]: {
    path: '/events/:id/admin/partners',
    method: 'GET',
    description: 'View partnership inquiries',
  },
  [EventsPermission.MANAGE_PARTNERS]: {
    path: '/events/:id/admin/partners',
    method: 'PATCH',
    description: 'Manage partnership inquiries and communications',
  },
  [EventsPermission.SEND_EMAILS]: {
    path: '/events/:id/admin/registrations/email/bulk',
    method: 'POST',
    description: 'Send bulk emails to registrants or partners',
  },
};

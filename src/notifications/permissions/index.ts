/**
 * Notifications Module Permissions
 * Centralized permission definitions for birthday and other notifications
 */

export enum NotificationsPermission {
  // Birthday notifications
  RECEIVE_BIRTHDAY_NOTIFICATION = 'notifications:receive-birthday',
  RECEIVE_PRE_BIRTHDAY_NOTIFICATION = 'notifications:receive-pre-birthday',
  SEND_BIRTHDAY_WISHES = 'notifications:send-birthday-wishes',

  // First-timer birthday notifications
  RECEIVE_FIRST_TIMER_BIRTHDAY_NOTIFICATION = 'notifications:receive-first-timer-birthday',

  // General notification permissions
  VIEW_NOTIFICATIONS = 'notifications:view',
  MANAGE_NOTIFICATIONS = 'notifications:manage',
}

/**
 * Permission metadata for endpoint mapping
 */
export const NotificationsPermissionMetadata = {
  [NotificationsPermission.RECEIVE_BIRTHDAY_NOTIFICATION]: {
    description: 'Receive notifications about member birthdays on the day',
  },
  [NotificationsPermission.RECEIVE_PRE_BIRTHDAY_NOTIFICATION]: {
    description: 'Receive pre-birthday notifications 3 days before member birthdays',
  },
  [NotificationsPermission.SEND_BIRTHDAY_WISHES]: {
    description: 'Send birthday wishes to members',
  },
  [NotificationsPermission.RECEIVE_FIRST_TIMER_BIRTHDAY_NOTIFICATION]: {
    description: 'Receive notifications when first timers being followed up have birthdays',
  },
  [NotificationsPermission.VIEW_NOTIFICATIONS]: {
    path: '/notifications',
    method: 'GET',
    description: 'View notifications',
  },
  [NotificationsPermission.MANAGE_NOTIFICATIONS]: {
    description: 'Manage notification settings',
  },
};

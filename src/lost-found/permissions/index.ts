/**
 * Lost & Found Module Permissions
 * Care Closet lost-and-found on the public website.
 */

export enum LostFoundPermission {
  // Workforce: post a found item (it waits for review) and see your own posts
  CREATE_ITEM = 'lost-found:create',

  // Care desk: see every item, review, edit, delete
  VIEW_ITEMS = 'lost-found:view',
  MANAGE_ITEMS = 'lost-found:manage',

  // Claims ("This is mine")
  VIEW_CLAIMS = 'lost-found:view-claims',
  // Approve/reject claims; also unmasks claimant phone numbers
  MANAGE_CLAIMS = 'lost-found:manage-claims',
}

export const LostFoundPermissionMetadata = {
  [LostFoundPermission.CREATE_ITEM]: {
    path: '/lost-found/items',
    method: 'POST',
    description: 'Post a found item (waits for review)',
  },
  [LostFoundPermission.VIEW_ITEMS]: {
    path: '/lost-found/items',
    method: 'GET',
    description: 'View all lost-and-found items',
  },
  [LostFoundPermission.MANAGE_ITEMS]: {
    path: '/lost-found/items/:id',
    method: 'PATCH',
    description: 'Review, edit and delete lost-and-found items',
  },
  [LostFoundPermission.VIEW_CLAIMS]: {
    path: '/lost-found/claims',
    method: 'GET',
    description: 'View claims on lost items (phone numbers masked)',
  },
  [LostFoundPermission.MANAGE_CLAIMS]: {
    path: '/lost-found/claims/:id',
    method: 'PATCH',
    description: 'Approve or reject claims; see claimant phone numbers',
  },
};

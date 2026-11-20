/**
 * Website Module Permissions
 * Content shown on the public website (powerpointtribe site) and its inbox.
 */

export enum WebsitePermission {
  // Content: sermons, series, devotionals, pastors, testimonies, snippets, FAQs
  VIEW_CONTENT = 'website:view-content',
  CREATE_CONTENT = 'website:create-content',
  UPDATE_CONTENT = 'website:update-content',
  DELETE_CONTENT = 'website:delete-content',
  // Needed on top of create/update to change `status` or `publishAt`
  PUBLISH_CONTENT = 'website:publish-content',

  // Site settings (service strip, socials, hero video, contact emails)
  MANAGE_SETTINGS = 'website:manage-settings',

  // Inbox (plan a visit, partner, care drop-off, David's Company, event notify)
  VIEW_SUBMISSIONS = 'website:view-submissions',
  MANAGE_SUBMISSIONS = 'website:manage-submissions',

  // Merch drop / newsletter sign-ups
  EXPORT_SUBSCRIPTIONS = 'website:export-subscriptions',

  // Image uploads for website content
  UPLOAD = 'website:upload',
}

export const WebsitePermissionMetadata = {
  [WebsitePermission.VIEW_CONTENT]: {
    path: '/website/sermons',
    method: 'GET',
    description: 'View website content (sermons, series, pastors, FAQs...)',
  },
  [WebsitePermission.CREATE_CONTENT]: {
    path: '/website/sermons',
    method: 'POST',
    description: 'Create website content (as draft)',
  },
  [WebsitePermission.UPDATE_CONTENT]: {
    path: '/website/sermons/:id',
    method: 'PATCH',
    description: 'Edit website content',
  },
  [WebsitePermission.DELETE_CONTENT]: {
    path: '/website/sermons/:id',
    method: 'DELETE',
    description: 'Delete website content',
  },
  [WebsitePermission.PUBLISH_CONTENT]: {
    description: 'Publish, schedule or unpublish website content',
  },
  [WebsitePermission.MANAGE_SETTINGS]: {
    path: '/website/settings',
    method: 'PATCH',
    description: 'Edit website settings',
  },
  [WebsitePermission.VIEW_SUBMISSIONS]: {
    path: '/website/submissions',
    method: 'GET',
    description: 'View website form submissions',
  },
  [WebsitePermission.MANAGE_SUBMISSIONS]: {
    path: '/website/submissions/:id',
    method: 'PATCH',
    description: 'Update or delete website form submissions',
  },
  [WebsitePermission.EXPORT_SUBSCRIPTIONS]: {
    path: '/website/subscriptions',
    method: 'GET',
    description: 'View and export merch drop / newsletter sign-ups',
  },
  [WebsitePermission.UPLOAD]: {
    path: '/upload/website-image',
    method: 'POST',
    description: 'Upload images for website content',
  },
};

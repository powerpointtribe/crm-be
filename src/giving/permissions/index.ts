/**
 * Giving Module Permissions
 * Giving accounts shown on the website (maker/checker) and online donations.
 */

export enum GivingPermission {
  VIEW_ACCOUNTS = 'giving:view-accounts',
  // Create drafts and request changes
  MANAGE_ACCOUNTS = 'giving:manage-accounts',
  // Approve/reject drafts and changes made by someone else
  APPROVE_ACCOUNTS = 'giving:approve-accounts',

  // Donation list with donor contact details
  VIEW_DONATIONS = 'giving:view-donations',
  // Totals only (no donor details)
  VIEW_DONATION_TOTALS = 'giving:view-donation-totals',
  EXPORT_DONATIONS = 'giving:export-donations',
}

export const GivingPermissionMetadata = {
  [GivingPermission.VIEW_ACCOUNTS]: {
    path: '/giving/accounts',
    method: 'GET',
    description: 'View giving accounts (incl. drafts and pending changes)',
  },
  [GivingPermission.MANAGE_ACCOUNTS]: {
    path: '/giving/accounts',
    method: 'POST',
    description: 'Draft giving accounts and request changes',
  },
  [GivingPermission.APPROVE_ACCOUNTS]: {
    path: '/giving/accounts/:id/approve',
    method: 'POST',
    description: "Approve or reject someone else's giving account draft/change",
  },
  [GivingPermission.VIEW_DONATIONS]: {
    path: '/giving/donations',
    method: 'GET',
    description: 'View online donations with donor details',
  },
  [GivingPermission.VIEW_DONATION_TOTALS]: {
    path: '/giving/donations/totals',
    method: 'GET',
    description: 'View online donation totals (no donor details)',
  },
  [GivingPermission.EXPORT_DONATIONS]: {
    path: '/giving/donations/export',
    method: 'GET',
    description: 'Export online donations as CSV',
  },
};

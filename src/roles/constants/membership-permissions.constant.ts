/**
 * Membership-based permissions
 *
 * These permissions are automatically granted to users based on their membershipStatus.
 * When a user is upgraded to a certain status (e.g., LXL), they automatically receive
 * the corresponding permissions. When downgraded, those permissions are removed.
 *
 * This is separate from role-based permissions - users can have both:
 * 1. Permissions from their assigned role
 * 2. Permissions from their membership status (defined here)
 */

import { MembershipStatus } from '../../common/enums/member-status.enum';

/**
 * Permissions automatically granted based on membership status
 * Higher statuses include all permissions from lower statuses
 */
export const MEMBERSHIP_BASED_PERMISSIONS: Record<MembershipStatus, string[]> = {
  // Regular members - no additional permissions
  [MembershipStatus.MEMBER]: [],

  // DC (David's Company) - no additional finance permissions
  [MembershipStatus.DC]: [],

  // LXL (League of Extraordinary Leaders) - can create and view their own requisitions
  [MembershipStatus.LXL]: [
    'finance:create-requisition',
    'finance:view-my-requisitions',
    'finance:view-requisition-details',
    'finance:update-requisition',
    'finance:view-expense-categories',
    'finance:view-form-fields',
  ],

  // Director - same as LXL plus approval capabilities
  [MembershipStatus.DIRECTOR]: [
    'finance:create-requisition',
    'finance:view-my-requisitions',
    'finance:view-requisition-details',
    'finance:view-requisitions',
    'finance:update-requisition',
    'finance:view-expense-categories',
    'finance:view-form-fields',
    'finance:view-pending-approvals',
    'finance:approve-requisition',
    'finance:reject-requisition',
    'finance:view-reports',
    'finance:view-dashboard',
  ],

  // Pastor - same as Director plus disbursement
  [MembershipStatus.PASTOR]: [
    'finance:create-requisition',
    'finance:view-my-requisitions',
    'finance:view-requisition-details',
    'finance:view-requisitions',
    'finance:update-requisition',
    'finance:view-expense-categories',
    'finance:view-form-fields',
    'finance:view-pending-approvals',
    'finance:view-pending-disbursements',
    'finance:approve-requisition',
    'finance:reject-requisition',
    'finance:disburse',
    'finance:view-reports',
    'finance:export-reports',
    'finance:view-dashboard',
  ],

  // Campus Pastor - same as Pastor
  [MembershipStatus.CAMPUS_PASTOR]: [
    'finance:create-requisition',
    'finance:view-my-requisitions',
    'finance:view-requisition-details',
    'finance:view-requisitions',
    'finance:update-requisition',
    'finance:view-expense-categories',
    'finance:view-form-fields',
    'finance:view-pending-approvals',
    'finance:view-pending-disbursements',
    'finance:approve-requisition',
    'finance:reject-requisition',
    'finance:disburse',
    'finance:manage-expense-categories',
    'finance:manage-form-fields',
    'finance:view-reports',
    'finance:export-reports',
    'finance:view-dashboard',
  ],

  // Senior Pastor - full finance access
  [MembershipStatus.SENIOR_PASTOR]: [
    'finance:create-requisition',
    'finance:view-my-requisitions',
    'finance:view-requisition-details',
    'finance:view-requisitions',
    'finance:update-requisition',
    'finance:delete-requisition',
    'finance:view-expense-categories',
    'finance:create-expense-category',
    'finance:update-expense-category',
    'finance:delete-expense-category',
    'finance:manage-expense-categories',
    'finance:view-form-fields',
    'finance:manage-form-fields',
    'finance:view-pending-approvals',
    'finance:view-pending-disbursements',
    'finance:approve-requisition',
    'finance:reject-requisition',
    'finance:disburse',
    'finance:view-reports',
    'finance:export-reports',
    'finance:view-dashboard',
  ],

  // Left/Relocated members - no permissions
  [MembershipStatus.LEFT]: [],
  [MembershipStatus.RELOCATED]: [],
};

/**
 * Get permissions for a given membership status
 * @param status The membership status
 * @returns Array of permission names granted by this status
 */
export function getPermissionsForMembershipStatus(status: MembershipStatus | string): string[] {
  if (!status || !(status in MEMBERSHIP_BASED_PERMISSIONS)) {
    return [];
  }
  return MEMBERSHIP_BASED_PERMISSIONS[status as MembershipStatus] || [];
}

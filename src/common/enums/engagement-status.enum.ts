/**
 * Engagement Status Enum
 * Used specifically for First Timers module to track their engagement journey
 * This is different from MembershipStatus which is used for church members
 */
export enum EngagementStatus {
  NEW = 'NEW',                                   // First timer just registered, no contact yet
  ENGAGED = 'ENGAGED',                           // First timer is being followed up/engaged with
  READY_FOR_INTEGRATION = 'READY_FOR_INTEGRATION', // First timer is ready to be integrated as a member
  ARCHIVED = 'ARCHIVED',                         // First timer has been archived (inactive/lost contact)
  CLOSED = 'CLOSED',                             // First timer engagement completed (converted to member)
}

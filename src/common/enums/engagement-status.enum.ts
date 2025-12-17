/**
 * Engagement Status Enum
 * Used specifically for First Timers module to track their engagement journey
 * This is different from MembershipStatus which is used for church members
 */
export enum EngagementStatus {
  NEW = 'NEW',           // First timer just registered, no contact yet
  ENGAGED = 'ENGAGED',   // First timer is being followed up/engaged with
  CLOSED = 'CLOSED',     // First timer engagement completed (converted to member or archived)
}

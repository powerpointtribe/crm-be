/**
 * Member Status Enum
 * Represents the hierarchical status/position of members in the church
 * This is different from EngagementStatus which is used for first-timers
 */
export enum MembershipStatus {
  MEMBER = 'MEMBER',           // Regular church member
  DC = 'DC',                   // Discipleship Class member
  LXL = 'LXL',                 // Leadership Excellence Level
  DIRECTOR = 'DIRECTOR',       // Director level
  PASTOR = 'PASTOR',           // Pastor
  SENIOR_PASTOR = 'SENIOR_PASTOR', // Senior Pastor
  LEFT = 'LEFT',               // Member who has left the church
}

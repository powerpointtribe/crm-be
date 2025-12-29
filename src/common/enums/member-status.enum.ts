/**
 * Member Status Enum
 * Represents the hierarchical status/position of members in the church
 * This is different from EngagementStatus which is used for first-timers
 */
export enum MembershipStatus {
  MEMBER = 'MEMBER', // Regular church member
  DC = 'DC', // David's Company
  LXL = 'LXL', // League of Xtraordinary Leaders
  DIRECTOR = 'DIRECTOR', // Director
  PASTOR = 'PASTOR', // Associate Pastor
  CAMPUS_PASTOR = 'CAMPUS_PASTOR', // Campus Expression Pastor
  SENIOR_PASTOR = 'SENIOR_PASTOR', // Senior Pastor
  LEFT = 'LEFT', // Member who has left the church
  RELOCATED = 'RELOCATED', // Member who has relocated
}

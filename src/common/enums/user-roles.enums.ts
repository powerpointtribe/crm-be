export enum UserRole {
  MEMBER = 'member',
  DC = 'dc', // David's Company (workers)
  LXL = 'lxl', // League of Extraordinary Leaders
  DIRECTOR = 'director', // In charge of LXL members within ministry
  ASSISTANT_PASTOR = 'assistant_pastor', // Assistant Pastor (branch + district scoped)
  BRANCH_PASTOR = 'branch_pastor', // Branch Pastor (branch-scoped access)
  PASTOR = 'pastor', // Church pastors (legacy - maps to branch pastor)
  SENIOR_PASTOR = 'senior_pastor', // Senior Pastor (global access across all branches)
  ADMIN = 'admin', // System administrators
  SUPER_ADMIN = 'super_admin', // Super administrators
}

export const ROLE_HIERARCHY = {
  [UserRole.MEMBER]: 1,
  [UserRole.DC]: 2,
  [UserRole.LXL]: 3,
  [UserRole.DIRECTOR]: 4,
  [UserRole.ASSISTANT_PASTOR]: 5,
  [UserRole.BRANCH_PASTOR]: 6,
  [UserRole.PASTOR]: 6, // Legacy - same level as branch pastor
  [UserRole.SENIOR_PASTOR]: 7,
  [UserRole.ADMIN]: 8,
  [UserRole.SUPER_ADMIN]: 9,
};

export const LXL_ROLES = [UserRole.LXL, UserRole.DIRECTOR, UserRole.PASTOR];

// Pastoral roles for access control
export const PASTORAL_ROLES = [
  UserRole.ASSISTANT_PASTOR,
  UserRole.BRANCH_PASTOR,
  UserRole.PASTOR,
  UserRole.SENIOR_PASTOR,
];

// Roles with global access (no branch/district restrictions)
export const GLOBAL_ACCESS_ROLES = [
  UserRole.SENIOR_PASTOR,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

// Roles with branch-scoped access
export const BRANCH_SCOPED_ROLES = [
  UserRole.BRANCH_PASTOR,
  UserRole.PASTOR, // Legacy
];

// Roles with district-scoped access within a branch
export const DISTRICT_SCOPED_ROLES = [UserRole.ASSISTANT_PASTOR];

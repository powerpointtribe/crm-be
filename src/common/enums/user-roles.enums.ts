export enum UserRole {
  MEMBER = 'member',
  DC = 'dc', // David's Company (workers)
  LXL = 'lxl', // League of Extraordinary Leaders
  DIRECTOR = 'director', // In charge of LXL members within ministry
  PASTOR = 'pastor', // Church pastors
  ADMIN = 'admin', // System administrators
  SUPER_ADMIN = 'super_admin', // Super administrators
}

export const ROLE_HIERARCHY = {
  [UserRole.MEMBER]: 1,
  [UserRole.DC]: 2,
  [UserRole.LXL]: 3,
  [UserRole.DIRECTOR]: 4,
  [UserRole.PASTOR]: 4,
  [UserRole.ADMIN]: 5,
  [UserRole.SUPER_ADMIN]: 6,
};

export const LXL_ROLES = [UserRole.LXL, UserRole.DIRECTOR, UserRole.PASTOR];

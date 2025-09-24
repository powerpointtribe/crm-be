export enum GroupType {
  DISTRICT = 'district', // Home cell groups - MANDATORY for all members
  UNIT = 'unit', // Departments - OPTIONAL but most members should have one
  FELLOWSHIP = 'fellowship', // Additional fellowships
  MINISTRY = 'ministry', // Ministry groups
  COMMITTEE = 'committee', // Committee groups
}

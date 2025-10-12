export enum EngagementStatus {
  NEW = 'new',
  FOLLOWING_UP = 'following_up',
  MEMBER = 'member',
  NOT_JOINED = 'not_joined',
  // Legacy statuses for backward compatibility
  NOT_CONTACTED = 'not_contacted',
  CONTACTED = 'contacted',
  SCHEDULED_VISIT = 'scheduled_visit',
  VISITED = 'visited',
  JOINED_GROUP = 'joined_group',
  CONVERTED = 'converted',
  LOST_CONTACT = 'lost_contact',
}

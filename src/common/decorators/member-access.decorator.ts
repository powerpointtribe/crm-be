import { ResourceAccess } from './resource-access.decorator';

export const MemberAccess = (
  operation: 'read' | 'write' | 'manage' = 'read',
  allowSelfAccess = false,
) => ResourceAccess({ resource: 'member', operation, allowSelfAccess });

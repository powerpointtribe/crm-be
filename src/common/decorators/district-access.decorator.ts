import { ResourceAccess } from './resource-access.decorator';

export const DistrictAccess = (
  operation: 'read' | 'write' | 'manage' = 'read',
) => ResourceAccess({ resource: 'district', operation });

import { ResourceAccess } from './resource-access.decorator';

export const UnitAccess = (operation: 'read' | 'write' | 'manage' = 'read') =>
  ResourceAccess({ resource: 'unit', operation });

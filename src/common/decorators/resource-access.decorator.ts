import { SetMetadata } from '@nestjs/common';

export const RESOURCE_ACCESS_KEY = 'resourceAccess';

export interface ResourceAccessConfig {
  resource: 'district' | 'unit' | 'member' | 'any';
  operation: 'read' | 'write' | 'manage';
  allowSelfAccess?: boolean; // For members accessing their own data
}

export const ResourceAccess = (config: ResourceAccessConfig) =>
  SetMetadata(RESOURCE_ACCESS_KEY, config);

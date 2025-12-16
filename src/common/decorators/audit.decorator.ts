import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../enums/audit-action.enum';

export interface AuditOptions {
  action: AuditAction;
  entity: AuditEntity;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  skipAudit?: boolean;
}

export const AUDIT_KEY = 'audit_log';
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

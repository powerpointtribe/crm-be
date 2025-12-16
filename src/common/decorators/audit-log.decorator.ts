import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../enums/audit-action.enum';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: AuditAction;
  entityType: AuditEntity;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  getEntityId?: (result: any, request: any) => string;
}

/**
 * Decorator to automatically log actions to the audit log
 *
 * @param metadata - Configuration for audit logging
 *
 * @example
 * // For CREATE operations
 * @Post()
 * @AuditLog({
 *   action: AuditAction.MEMBER_CREATED,
 *   entityType: AuditEntity.MEMBER,
 *   description: 'Created a new member',
 *   getEntityId: (result) => result._id.toString()
 * })
 * async create(@Body() dto: CreateMemberDto) { ... }
 *
 * @example
 * // For UPDATE operations
 * @Patch(':id')
 * @AuditLog({
 *   action: AuditAction.MEMBER_UPDATED,
 *   entityType: AuditEntity.MEMBER,
 *   description: 'Updated member information',
 *   getEntityId: (result, request) => request.params.id
 * })
 * async update(@Param('id') id: string, @Body() dto: UpdateMemberDto) { ... }
 *
 * @example
 * // For DELETE operations
 * @Delete(':id')
 * @AuditLog({
 *   action: AuditAction.MEMBER_DELETED,
 *   entityType: AuditEntity.MEMBER,
 *   description: 'Deleted a member',
 *   severity: 'high',
 *   getEntityId: (result, request) => request.params.id
 * })
 * async remove(@Param('id') id: string) { ... }
 */
export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_KEY, metadata);

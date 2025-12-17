import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import {
  QueueName,
  AuditLogJobData,
  JobType,
} from '../../common/interfaces/queue-job.interface';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';

@Injectable()
@Processor(QueueName.AUDIT_LOGS)
export class AuditLogProcessor {
  private readonly logger = new Logger(AuditLogProcessor.name);

  constructor(private auditLogsService: AuditLogsService) {
    this.logger.log('AuditLogProcessor initialized');
  }

  @Process(JobType.AUDIT_LOG_CREATE)
  async handleAuditLogCreate(job: Job<AuditLogJobData>) {
    this.logger.debug(
      `Processing audit log creation for entity: ${job.data.entityType}:${job.data.entityId}`,
    );

    try {
      const { action, entityType, entityId, userId, userEmail, userName, auditData } =
        job.data;

      // Create user object from job data
      const user = {
        _id: userId,
        email: userEmail,
        firstName: userName?.split(' ')[0] || '',
        lastName: userName?.split(' ').slice(1).join(' ') || '',
      };

      // Log the action using the audit logs service
      await this.auditLogsService.logAction(
        action as any, // Action is already validated as AuditAction enum value
        entityType as any, // EntityType is already validated as AuditEntity enum value
        entityId,
        user,
        auditData,
      );

      this.logger.debug(
        `Audit log created successfully for ${entityType}:${entityId}`,
      );
      return { success: true, entityId };
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

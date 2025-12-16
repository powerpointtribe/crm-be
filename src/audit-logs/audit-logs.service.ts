import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async create(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = new this.auditLogModel(createAuditLogDto);
      return await auditLog.save();
    } catch (error) {
      this.logger.error('Failed to create audit log', error.stack);
      throw error;
    }
  }

  async logAction(
    action: AuditAction,
    entityType: AuditEntity,
    entityId: string,
    performedBy: any,
    options: {
      description?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      metadata?: any;
      severity?: string;
      relatedUnit?: string;
      relatedDistrict?: string;
      tags?: string[];
    } = {},
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Validate required data before creating audit log
        if (!performedBy) {
          this.logger.warn(
            `Audit log attempted with null performedBy for ${action} on ${entityType}:${entityId}`,
          );
          return;
        }

        if (!performedBy._id && !performedBy.id) {
          this.logger.warn(
            `Audit log attempted with invalid performedBy (missing ID) for ${action} on ${entityType}:${entityId}`,
          );
          return;
        }

        if (
          !performedBy.firstName ||
          !performedBy.lastName ||
          !performedBy.email
        ) {
          this.logger.warn(
            `Audit log attempted with incomplete performedBy data for ${action} on ${entityType}:${entityId}`,
          );
        }

        const auditLogData: CreateAuditLogDto = {
          action,
          entityType,
          entityId,
          performedBy: performedBy._id || performedBy.id,
          performedByName: `${performedBy.firstName || 'Unknown'} ${performedBy.lastName || 'User'}`,
          performedByEmail: performedBy.email || 'unknown@unknown.com',
          performedByRoles: performedBy.systemRoles || ['MEMBER'],
          severity: options.severity || 'medium',
          isSystemGenerated: false,
          ...options,
        };

        // Clean up metadata to avoid circular references
        if (options.metadata) {
          auditLogData.metadata = this.sanitizeMetadata(options.metadata);
        }

        await this.create(auditLogData);
        return; // Success, exit retry loop
      } catch (error) {
        attempt++;
        this.logger.error(
          `Failed to log audit action (attempt ${attempt}/${maxRetries}): ${action} on ${entityType}:${entityId}`,
          error.stack,
        );

        if (attempt >= maxRetries) {
          // Log to a fallback mechanism or alert system
          this.logger.error(
            `CRITICAL: Failed to log audit action after ${maxRetries} attempts: ${action} on ${entityType}:${entityId}. This may indicate a serious system issue.`,
          );

          // In production, you might want to send an alert or write to a fallback storage
          await this.handleAuditLogFailure(
            action,
            entityType,
            entityId,
            performedBy,
            options,
            error,
          );
        } else {
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 100);
        }
      }
    }
  }

  private sanitizeMetadata(metadata: any): any {
    try {
      // Remove circular references and limit depth
      return JSON.parse(JSON.stringify(metadata, null, 2));
    } catch (error) {
      this.logger.warn(
        'Failed to sanitize metadata for audit log',
        error.message,
      );
      return { error: 'Failed to serialize metadata' };
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async handleAuditLogFailure(
    action: AuditAction,
    entityType: AuditEntity,
    entityId: string,
    performedBy: any,
    options: any,
    error: any,
  ): Promise<void> {
    try {
      // Create a simplified fallback audit log entry
      const fallbackLog = {
        action,
        entityType,
        entityId,
        performedBy: performedBy?._id || performedBy?.id || 'unknown',
        performedByName: 'System Error',
        performedByEmail: 'system@error.com',
        performedByRoles: ['SYSTEM'],
        description: `FALLBACK: Original action failed to log - ${action}`,
        severity: 'critical',
        isSystemGenerated: true,
        metadata: {
          originalError: error.message,
          originalAction: action,
          originalEntityType: entityType,
          originalEntityId: entityId,
          failureTimestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      // Try to save the fallback log with minimal validation
      const fallbackAuditLog = new this.auditLogModel(fallbackLog);
      await fallbackAuditLog.save();

      this.logger.log(
        'Fallback audit log created for failed primary audit log',
      );
    } catch (fallbackError) {
      this.logger.error(
        'Even fallback audit logging failed',
        fallbackError.stack,
      );
      // At this point, consider external alerting or file-based logging
    }
  }

  async findAll(queryDto: AuditLogQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      startDate,
      endDate,
      search,
      ...filters
    } = queryDto;

    const query: FilterQuery<AuditLogDocument> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query[key] = value;
      }
    });

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { performedByName: { $regex: search, $options: 'i' } },
        { performedByEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [auditLogs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .populate('performedBy', 'firstName lastName email systemRoles')
        .populate('relatedUnit', 'name type')
        .populate('relatedDistrict', 'name type')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    return {
      auditLogs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: auditLogs.length,
        total,
      },
    };
  }

  async findOne(id: string): Promise<AuditLog | null> {
    return this.auditLogModel
      .findById(id)
      .populate('performedBy', 'firstName lastName email systemRoles')
      .populate('relatedUnit', 'name type')
      .populate('relatedDistrict', 'name type')
      .exec();
  }

  async getStatistics(filters: {
    startDate?: Date;
    endDate?: Date;
    entityType?: AuditEntity;
    relatedUnit?: string;
    relatedDistrict?: string;
  }) {
    const matchStage: any = {};

    if (filters.startDate || filters.endDate) {
      matchStage.timestamp = {};
      if (filters.startDate) matchStage.timestamp.$gte = filters.startDate;
      if (filters.endDate) matchStage.timestamp.$lte = filters.endDate;
    }

    if (filters.entityType) matchStage.entityType = filters.entityType;
    if (filters.relatedUnit) matchStage.relatedUnit = filters.relatedUnit;
    if (filters.relatedDistrict)
      matchStage.relatedDistrict = filters.relatedDistrict;

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $facet: {
          actionCounts: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          entityCounts: [
            { $group: { _id: '$entityType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          severityCounts: [
            { $group: { _id: '$severity', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          dailyActivity: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 30 },
          ],
          topUsers: [
            {
              $group: {
                _id: {
                  id: '$performedBy',
                  name: '$performedByName',
                  email: '$performedByEmail',
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ];

    const [result] = await this.auditLogModel.aggregate(pipeline).exec();

    return {
      ...result,
      totalCount: result.totalCount[0]?.total || 0,
    };
  }

  async deleteOldLogs(beforeDate: Date): Promise<{ deletedCount: number }> {
    const result = await this.auditLogModel.deleteMany({
      timestamp: { $lt: beforeDate },
    });

    this.logger.log(
      `Deleted ${result.deletedCount} old audit logs before ${beforeDate}`,
    );

    return { deletedCount: result.deletedCount };
  }

  async exportLogs(filters: AuditLogQueryDto, format: 'csv' | 'json' = 'json') {
    const { auditLogs } = await this.findAll({ ...filters, limit: 10000 });

    if (format === 'csv') {
      const csvFields = [
        'timestamp',
        'action',
        'entityType',
        'entityId',
        'performedByName',
        'performedByEmail',
        'description',
        'severity',
      ];

      const csvData = auditLogs.map((log) =>
        csvFields.map((field) => log[field] || '').join(','),
      );

      const csvHeader = csvFields.join(',');
      return [csvHeader, ...csvData].join('\n');
    }

    return auditLogs;
  }
}

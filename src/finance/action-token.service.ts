import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import {
  ActionToken,
  ActionTokenDocument,
  ActionTokenType,
} from './schemas/action-token.schema';

export interface TokenValidationResult {
  valid: boolean;
  actionToken?: ActionTokenDocument;
  error?: string;
}

@Injectable()
export class ActionTokenService {
  private readonly logger = new Logger(ActionTokenService.name);
  private readonly TOKEN_EXPIRY_HOURS = 504; // 21 days (21 * 24 hours)

  constructor(
    @InjectModel(ActionToken.name)
    private actionTokenModel: Model<ActionTokenDocument>,
  ) {}

  /**
   * Generate a cryptographically secure 64-character hex token
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create an action token for a requisition
   */
  async createActionToken(
    requisitionId: string | Types.ObjectId,
    actionType: ActionTokenType,
    recipientEmail: string,
    recipientMemberId?: string | Types.ObjectId,
  ): Promise<ActionTokenDocument> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    const actionToken = new this.actionTokenModel({
      token,
      requisitionId: new Types.ObjectId(requisitionId.toString()),
      actionType,
      recipientEmail: recipientEmail.toLowerCase(),
      recipientMemberId: recipientMemberId
        ? new Types.ObjectId(recipientMemberId.toString())
        : undefined,
      expiresAt,
      isUsed: false,
      usedAt: null,
    });

    return actionToken.save();
  }

  /**
   * Create approve and reject tokens for a requisition (used for approvers)
   */
  async createApprovalTokens(
    requisitionId: string | Types.ObjectId,
    recipientEmail: string,
    recipientMemberId?: string | Types.ObjectId,
  ): Promise<{ approveToken: ActionTokenDocument; rejectToken: ActionTokenDocument }> {
    const [approveToken, rejectToken] = await Promise.all([
      this.createActionToken(
        requisitionId,
        ActionTokenType.APPROVE,
        recipientEmail,
        recipientMemberId,
      ),
      this.createActionToken(
        requisitionId,
        ActionTokenType.REJECT,
        recipientEmail,
        recipientMemberId,
      ),
    ]);

    return { approveToken, rejectToken };
  }

  /**
   * Validate an action token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    if (!token || token.length !== 64) {
      return { valid: false, error: 'Invalid token format' };
    }

    const actionToken = await this.actionTokenModel.findOne({ token });

    if (!actionToken) {
      return { valid: false, error: 'Token not found' };
    }

    if (actionToken.isUsed) {
      return { valid: false, error: 'Token has already been used' };
    }

    if (new Date() > actionToken.expiresAt) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, actionToken };
  }

  /**
   * Mark a token as used
   */
  async markTokenAsUsed(token: string): Promise<ActionTokenDocument | null> {
    return this.actionTokenModel.findOneAndUpdate(
      { token },
      {
        isUsed: true,
        usedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Invalidate all tokens for a requisition (called when status changes)
   */
  async invalidateTokensForRequisition(
    requisitionId: string | Types.ObjectId,
  ): Promise<number> {
    const result = await this.actionTokenModel.updateMany(
      {
        requisitionId: new Types.ObjectId(requisitionId.toString()),
        isUsed: false,
      },
      {
        isUsed: true,
        usedAt: new Date(),
      },
    );

    return result.modifiedCount;
  }

  /**
   * Invalidate specific action type tokens for a requisition
   */
  async invalidateTokensByType(
    requisitionId: string | Types.ObjectId,
    actionType: ActionTokenType,
  ): Promise<number> {
    const result = await this.actionTokenModel.updateMany(
      {
        requisitionId: new Types.ObjectId(requisitionId.toString()),
        actionType,
        isUsed: false,
      },
      {
        isUsed: true,
        usedAt: new Date(),
      },
    );

    return result.modifiedCount;
  }

  /**
   * Get token with populated requisition
   */
  async getTokenWithRequisition(token: string): Promise<ActionTokenDocument | null> {
    return this.actionTokenModel
      .findOne({ token })
      .populate({
        path: 'requisitionId',
        populate: [
          { path: 'branch', select: 'name slug' },
          { path: 'requestor', select: 'firstName lastName email' },
          { path: 'expenseCategory', select: 'name description' },
          { path: 'approvedBy', select: 'firstName lastName email' },
        ],
      });
  }

  /**
   * Cleanup expired tokens (runs daily at midnight)
   * Note: MongoDB TTL index should handle this, but this provides additional cleanup
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await this.actionTokenModel.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isUsed: true, usedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Delete used tokens older than 7 days
        ],
      });

      if (result.deletedCount > 0) {
        this.logger.log(`Cleaned up ${result.deletedCount} expired/used action tokens`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Find all valid (unused, unexpired) tokens for a requisition
   */
  async findValidTokensForRequisition(
    requisitionId: string | Types.ObjectId,
  ): Promise<ActionTokenDocument[]> {
    return this.actionTokenModel.find({
      requisitionId: new Types.ObjectId(requisitionId.toString()),
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Find the used approval token for a requisition
   */
  async findUsedApprovalToken(requisitionId: Types.ObjectId): Promise<ActionTokenDocument | null> {
    return this.actionTokenModel.findOne({
      requisitionId,
      actionType: ActionTokenType.APPROVE,
      isUsed: true,
    });
  }
}

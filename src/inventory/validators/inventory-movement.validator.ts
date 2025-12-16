import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../schemas/inventory-item.schema';
import {
  InventoryMovement,
  InventoryMovementDocument,
} from '../schemas/inventory-movement.schema';
import { CreateInventoryMovementDto } from '../dto/create-inventory-movement.dto';
import {
  InventoryMovementType,
  InventoryStatus,
} from '../../common/enums/inventory.enum';

export interface ValidationRule {
  name: string;
  validate: (
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ) => Promise<ValidationResult>;
}

export interface ValidationContext {
  inventoryItem?: InventoryItemDocument;
  user?: any;
  existingMovements?: InventoryMovementDocument[];
}

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
}

@Injectable()
export class InventoryMovementValidator {
  private validationRules: ValidationRule[] = [];

  constructor(
    @InjectModel(InventoryItem.name)
    private inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
  ) {
    this.initializeRules();
  }

  private initializeRules(): void {
    this.validationRules = [
      {
        name: 'InventoryItemExists',
        validate: this.validateInventoryItemExists.bind(this),
      },
      {
        name: 'InventoryItemActive',
        validate: this.validateInventoryItemActive.bind(this),
      },
      {
        name: 'StockAvailability',
        validate: this.validateStockAvailability.bind(this),
      },
      {
        name: 'TransferLocations',
        validate: this.validateTransferLocations.bind(this),
      },
      {
        name: 'MovementTypePermissions',
        validate: this.validateMovementTypePermissions.bind(this),
      },
      {
        name: 'BusinessRules',
        validate: this.validateBusinessRules.bind(this),
      },
      {
        name: 'DailyLimits',
        validate: this.validateDailyLimits.bind(this),
      },
      {
        name: 'ExpiryDate',
        validate: this.validateExpiryDate.bind(this),
      },
      {
        name: 'ApprovalRequirements',
        validate: this.validateApprovalRequirements.bind(this),
      },
    ];
  }

  async validate(
    dto: CreateInventoryMovementDto,
    context: ValidationContext = {},
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Load inventory item if not provided in context
    if (!context.inventoryItem) {
      const inventoryItem = await this.inventoryItemModel.findById(
        dto.inventoryItem,
      );
      context.inventoryItem = inventoryItem || undefined;
    }

    // Run all validation rules
    for (const rule of this.validationRules) {
      try {
        const result = await rule.validate(dto, context);

        if (!result.isValid) {
          errors.push(`${rule.name}: ${result.errorMessage}`);
        }

        if (result.warnings?.length) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        errors.push(`${rule.name}: Validation error - ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async validateInventoryItemExists(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.inventoryItem) {
      return {
        isValid: false,
        errorMessage: 'Inventory item not found',
      };
    }

    return { isValid: true };
  }

  private async validateInventoryItemActive(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.inventoryItem) {
      return { isValid: true }; // Will be caught by previous validation
    }

    if (context.inventoryItem.status !== InventoryStatus.ACTIVE) {
      return {
        isValid: false,
        errorMessage: `Cannot perform movements on ${context.inventoryItem.status} items`,
      };
    }

    return { isValid: true };
  }

  private async validateStockAvailability(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.inventoryItem) {
      return { isValid: true }; // Will be caught by previous validation
    }

    const outboundTypes = [
      InventoryMovementType.STOCK_OUT,
      InventoryMovementType.DONATED,
      InventoryMovementType.SOLD,
      InventoryMovementType.DAMAGE,
      InventoryMovementType.EXPIRED,
      InventoryMovementType.TRANSFER,
    ];

    if (outboundTypes.includes(dto.movementType)) {
      if (dto.quantity > context.inventoryItem.currentStock) {
        return {
          isValid: false,
          errorMessage: `Insufficient stock. Available: ${context.inventoryItem.currentStock}, Requested: ${dto.quantity}`,
        };
      }

      // Warn if going below reorder level
      const remainingStock = context.inventoryItem.currentStock - dto.quantity;
      const warnings: string[] = [];

      if (
        remainingStock <= context.inventoryItem.reorderLevel &&
        remainingStock > 0
      ) {
        warnings.push(
          'Stock will fall below reorder level after this movement',
        );
      }

      if (remainingStock === 0) {
        warnings.push('Item will be out of stock after this movement');
      }

      return {
        isValid: true,
        warnings,
      };
    }

    return { isValid: true };
  }

  private async validateTransferLocations(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (dto.movementType !== InventoryMovementType.TRANSFER) {
      return { isValid: true };
    }

    if (!dto.fromUnit && !dto.fromDistrict) {
      return {
        isValid: false,
        errorMessage:
          'Transfer movements require either fromUnit or fromDistrict',
      };
    }

    if (!dto.toUnit && !dto.toDistrict) {
      return {
        isValid: false,
        errorMessage: 'Transfer movements require either toUnit or toDistrict',
      };
    }

    // Ensure not transferring to the same location
    if (
      (dto.fromUnit && dto.toUnit && dto.fromUnit === dto.toUnit) ||
      (dto.fromDistrict &&
        dto.toDistrict &&
        dto.fromDistrict === dto.toDistrict)
    ) {
      return {
        isValid: false,
        errorMessage: 'Cannot transfer to the same location',
      };
    }

    return { isValid: true };
  }

  private async validateMovementTypePermissions(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.user) {
      return { isValid: true }; // Permission validation handled elsewhere
    }

    const restrictedTypes = [
      InventoryMovementType.ADJUSTMENT,
      InventoryMovementType.DAMAGE,
      InventoryMovementType.EXPIRED,
    ];

    if (restrictedTypes.includes(dto.movementType)) {
      const hasPermission =
        context.user.systemRoles?.includes('ADMIN') ||
        context.user.systemRoles?.includes('SUPER_ADMIN');

      if (!hasPermission) {
        return {
          isValid: false,
          errorMessage: `Movement type ${dto.movementType} requires administrator privileges`,
        };
      }
    }

    return { isValid: true };
  }

  private async validateBusinessRules(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const warnings: string[] = [];

    // High value movement warning
    if (dto.unitCost && dto.unitCost * dto.quantity > 10000) {
      warnings.push(
        'High value movement detected - consider approval workflow',
      );
    }

    // Large quantity movement warning
    if (
      context.inventoryItem &&
      dto.quantity > context.inventoryItem.currentStock * 0.5
    ) {
      warnings.push('Large quantity movement (>50% of current stock)');
    }

    // Expiry date validation for incoming stock
    if (dto.movementType === InventoryMovementType.STOCK_IN && dto.expiryDate) {
      const expiryDate = new Date(dto.expiryDate);
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

      if (expiryDate < threeMonthsFromNow) {
        warnings.push(
          'Incoming stock has short expiry date (less than 3 months)',
        );
      }

      if (expiryDate < new Date()) {
        return {
          isValid: false,
          errorMessage: 'Cannot add expired stock',
        };
      }
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async validateDailyLimits(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.user) {
      return { isValid: true };
    }

    // Check daily movement limits for non-admin users
    const isAdmin =
      context.user.systemRoles?.includes('ADMIN') ||
      context.user.systemRoles?.includes('SUPER_ADMIN');

    if (!isAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayMovements = await this.movementModel.countDocuments({
        performedBy: context.user._id,
        movementDate: {
          $gte: today,
          $lt: tomorrow,
        },
      });

      const DAILY_MOVEMENT_LIMIT = 50; // Configurable limit
      if (todayMovements >= DAILY_MOVEMENT_LIMIT) {
        return {
          isValid: false,
          errorMessage: `Daily movement limit (${DAILY_MOVEMENT_LIMIT}) exceeded`,
        };
      }
    }

    return { isValid: true };
  }

  private async validateExpiryDate(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    if (!context.inventoryItem) {
      return { isValid: true };
    }

    // Warn about movements on items nearing expiry
    if (context.inventoryItem.expiryDate) {
      const expiryDate = new Date(context.inventoryItem.expiryDate);
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      const warnings: string[] = [];

      if (
        expiryDate < oneMonthFromNow &&
        dto.movementType === InventoryMovementType.STOCK_IN
      ) {
        warnings.push('Adding stock to an item that expires within one month');
      }

      if (expiryDate < new Date()) {
        if (dto.movementType !== InventoryMovementType.EXPIRED) {
          warnings.push(
            'Item has already expired - consider marking as expired',
          );
        }
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return { isValid: true };
  }

  private async validateApprovalRequirements(
    dto: CreateInventoryMovementDto,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const highValueThreshold = 5000;
    const totalValue = (dto.unitCost || 0) * dto.quantity;

    const requiresApproval =
      totalValue > highValueThreshold ||
      dto.movementType === InventoryMovementType.ADJUSTMENT ||
      (context.inventoryItem &&
        dto.quantity > context.inventoryItem.currentStock * 0.8);

    if (requiresApproval && dto.status === 'approved' && context.user) {
      const canAutoApprove =
        context.user.systemRoles?.includes('ADMIN') ||
        context.user.systemRoles?.includes('SUPER_ADMIN') ||
        context.user.systemRoles?.includes('PASTOR');

      if (!canAutoApprove) {
        return {
          isValid: true,
          warnings: ['Movement requires approval - setting status to pending'],
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Get movement constraints for a specific inventory item
   */
  async getMovementConstraints(itemId: string): Promise<{
    maxQuantity: number;
    allowedMovementTypes: InventoryMovementType[];
    requiresApproval: boolean;
    warnings: string[];
  }> {
    const item = await this.inventoryItemModel.findById(itemId);

    if (!item) {
      throw new BadRequestException('Inventory item not found');
    }

    const warnings: string[] = [];
    const maxQuantity = item.currentStock;
    let allowedMovementTypes = Object.values(InventoryMovementType);
    let requiresApproval = false;

    // Check if item is approaching expiry
    if (item.expiryDate) {
      const expiryDate = new Date(item.expiryDate);
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      if (expiryDate < oneMonthFromNow) {
        warnings.push('Item expires within one month');
      }

      if (expiryDate < new Date()) {
        warnings.push('Item has expired');
        allowedMovementTypes = [
          InventoryMovementType.EXPIRED,
          InventoryMovementType.ADJUSTMENT,
        ];
      }
    }

    // Check if item status affects available operations
    if (item.status !== InventoryStatus.ACTIVE) {
      allowedMovementTypes = [InventoryMovementType.ADJUSTMENT];
      requiresApproval = true;
    }

    // High-value items require approval for large movements
    if (item.unitCost && item.unitCost > 1000) {
      requiresApproval = true;
      warnings.push('High-value item - movements may require approval');
    }

    return {
      maxQuantity,
      allowedMovementTypes,
      requiresApproval,
      warnings,
    };
  }
}

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types, ClientSession } from 'mongoose';
import {
  InventoryMovement,
  InventoryMovementDocument,
} from './schemas/inventory-movement.schema';
import {
  InventoryItem,
  InventoryItemDocument,
} from './schemas/inventory-item.schema';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { InventoryMovementType } from '../common/enums/inventory.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';
import { InventoryMovementValidator } from './validators/inventory-movement.validator';

@Injectable()
export class InventoryMovementService {
  constructor(
    @InjectModel(InventoryMovement.name)
    private movementModel: Model<InventoryMovementDocument>,
    @InjectModel(InventoryItem.name)
    private inventoryItemModel: Model<InventoryItemDocument>,
    private auditLogsService: AuditLogsService,
    private movementValidator: InventoryMovementValidator,
  ) {}

  async processMovement(
    createMovementDto: CreateInventoryMovementDto,
    performedBy: any,
    session?: ClientSession,
  ): Promise<InventoryMovement> {
    const inventoryItem = await this.inventoryItemModel
      .findById(createMovementDto.inventoryItem)
      .session(session || null);

    if (!inventoryItem) {
      throw new NotFoundException('Inventory item not found');
    }

    // Validate the movement using the comprehensive validator
    const validationResult = await this.movementValidator.validate(
      createMovementDto,
      {
        inventoryItem,
        user: performedBy,
      },
    );

    if (!validationResult.isValid) {
      throw new BadRequestException(validationResult.errorMessage);
    }

    // Log warnings if any
    if (validationResult.warnings?.length) {
      console.warn('Movement warnings:', validationResult.warnings);
    }

    const previousStock = inventoryItem.currentStock;
    let newStock = previousStock;

    // Calculate new stock based on movement type
    switch (createMovementDto.movementType) {
      case InventoryMovementType.STOCK_IN:
      case InventoryMovementType.RETURNED:
        newStock = previousStock + createMovementDto.quantity;
        break;

      case InventoryMovementType.STOCK_OUT:
      case InventoryMovementType.DONATED:
      case InventoryMovementType.SOLD:
      case InventoryMovementType.DAMAGE:
      case InventoryMovementType.EXPIRED:
        newStock = previousStock - createMovementDto.quantity;
        break;

      case InventoryMovementType.ADJUSTMENT:
        newStock = createMovementDto.quantity;
        break;

      case InventoryMovementType.TRANSFER:
        if (!createMovementDto.fromUnit && !createMovementDto.fromDistrict) {
          throw new BadRequestException(
            'Transfer movements require fromUnit or fromDistrict',
          );
        }
        if (!createMovementDto.toUnit && !createMovementDto.toDistrict) {
          throw new BadRequestException(
            'Transfer movements require toUnit or toDistrict',
          );
        }
        newStock = previousStock - createMovementDto.quantity;
        break;
    }

    // Validate stock levels
    if (newStock < 0) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${previousStock}, Required: ${createMovementDto.quantity}`,
      );
    }

    // Calculate total cost if unit cost is provided
    const totalCost = createMovementDto.unitCost
      ? createMovementDto.unitCost * createMovementDto.quantity
      : undefined;

    // Create movement record
    const movement = new this.movementModel({
      ...createMovementDto,
      previousStock,
      newStock,
      totalCost,
      performedBy: performedBy._id,
      movementDate: createMovementDto.movementDate
        ? new Date(createMovementDto.movementDate)
        : new Date(),
      status: createMovementDto.status || 'approved',
    });

    const savedMovement = await movement.save({ session });

    // Update inventory item stock
    await this.inventoryItemModel.findByIdAndUpdate(
      createMovementDto.inventoryItem,
      {
        currentStock: newStock,
        lastStockCheck: new Date(),
        lastStockCheckedBy: performedBy._id,
        updatedBy: performedBy._id,
        updatedAt: new Date(),
      },
      { session },
    );

    // Log audit action
    await this.auditLogsService.logAction(
      this.getAuditAction(createMovementDto.movementType),
      AuditEntity.INVENTORY_ITEM,
      inventoryItem._id.toString(),
      performedBy,
      {
        description: `${createMovementDto.movementType}: ${createMovementDto.quantity} units. ${createMovementDto.reason}`,
        oldValues: { currentStock: previousStock },
        newValues: { currentStock: newStock },
        metadata: {
          movementId: savedMovement._id.toString(),
          movementType: createMovementDto.movementType,
          quantity: createMovementDto.quantity,
          referenceNumber: createMovementDto.referenceNumber,
        },
        relatedUnit: inventoryItem.assignedUnit?.toString(),
        relatedDistrict: inventoryItem.assignedDistrict?.toString(),
      },
    );

    return savedMovement;
  }

  private getAuditAction(movementType: InventoryMovementType): AuditAction {
    switch (movementType) {
      case InventoryMovementType.STOCK_IN:
        return AuditAction.INVENTORY_STOCK_ADDED;
      case InventoryMovementType.STOCK_OUT:
      case InventoryMovementType.DONATED:
      case InventoryMovementType.SOLD:
      case InventoryMovementType.DAMAGE:
      case InventoryMovementType.EXPIRED:
        return AuditAction.INVENTORY_STOCK_REMOVED;
      case InventoryMovementType.TRANSFER:
        return AuditAction.INVENTORY_ITEM_TRANSFERRED;
      default:
        return AuditAction.UPDATE;
    }
  }

  async findAll(
    inventoryItemId?: string,
    filters: {
      movementType?: InventoryMovementType;
      startDate?: Date;
      endDate?: Date;
      performedBy?: string;
      status?: string;
      unitId?: string;
      districtId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'movementDate',
      sortOrder = 'desc',
      ...otherFilters
    } = filters;

    const query: FilterQuery<InventoryMovementDocument> = {};

    if (inventoryItemId) {
      query.inventoryItem = new Types.ObjectId(inventoryItemId);
    }

    Object.entries(otherFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'startDate' || key === 'endDate') {
          if (!query.movementDate) query.movementDate = {};
          if (key === 'startDate') query.movementDate.$gte = value;
          if (key === 'endDate') query.movementDate.$lte = value;
        } else if (key === 'unitId') {
          query.$or = [
            { fromUnit: new Types.ObjectId(value as string) },
            { toUnit: new Types.ObjectId(value as string) },
          ];
        } else if (key === 'districtId') {
          query.$or = [
            { fromDistrict: new Types.ObjectId(value as string) },
            { toDistrict: new Types.ObjectId(value as string) },
          ];
        } else {
          query[key] = value;
        }
      }
    });

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [movements, total] = await Promise.all([
      this.movementModel
        .find(query)
        .populate('inventoryItem', 'name itemCode unitOfMeasurement')
        .populate('performedBy', 'firstName lastName email')
        .populate('fromUnit', 'name type')
        .populate('toUnit', 'name type')
        .populate('fromDistrict', 'name type')
        .populate('toDistrict', 'name type')
        .populate('receivedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.movementModel.countDocuments(query).exec(),
    ]);

    return {
      movements,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: movements.length,
        total,
      },
    };
  }

  async findOne(id: string): Promise<InventoryMovement> {
    const movement = await this.movementModel
      .findById(id)
      .populate('inventoryItem', 'name itemCode unitOfMeasurement')
      .populate('performedBy', 'firstName lastName email')
      .populate('fromUnit', 'name type')
      .populate('toUnit', 'name type')
      .populate('fromDistrict', 'name type')
      .populate('toDistrict', 'name type')
      .populate('receivedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .exec();

    if (!movement) {
      throw new NotFoundException('Movement record not found');
    }

    return movement;
  }

  async getMovementStatistics(
    inventoryItemId?: string,
    filters: {
      startDate?: Date;
      endDate?: Date;
      unitId?: string;
      districtId?: string;
    } = {},
  ) {
    const matchStage: any = {};

    if (inventoryItemId) {
      matchStage.inventoryItem = new Types.ObjectId(inventoryItemId);
    }

    if (filters.startDate || filters.endDate) {
      matchStage.movementDate = {};
      if (filters.startDate) matchStage.movementDate.$gte = filters.startDate;
      if (filters.endDate) matchStage.movementDate.$lte = filters.endDate;
    }

    if (filters.unitId) {
      matchStage.$or = [
        { fromUnit: new Types.ObjectId(filters.unitId) },
        { toUnit: new Types.ObjectId(filters.unitId) },
      ];
    }

    if (filters.districtId) {
      matchStage.$or = [
        { fromDistrict: new Types.ObjectId(filters.districtId) },
        { toDistrict: new Types.ObjectId(filters.districtId) },
      ];
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalMovements: { $sum: 1 },
                totalQuantityIn: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          '$movementType',
                          [
                            InventoryMovementType.STOCK_IN,
                            InventoryMovementType.RETURNED,
                          ],
                        ],
                      },
                      '$quantity',
                      0,
                    ],
                  },
                },
                totalQuantityOut: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          '$movementType',
                          [
                            InventoryMovementType.STOCK_OUT,
                            InventoryMovementType.DONATED,
                            InventoryMovementType.SOLD,
                            InventoryMovementType.DAMAGE,
                            InventoryMovementType.EXPIRED,
                            InventoryMovementType.TRANSFER,
                          ],
                        ],
                      },
                      '$quantity',
                      0,
                    ],
                  },
                },
                totalValue: { $sum: { $ifNull: ['$totalCost', 0] } },
              },
            },
          ],
          movementTypes: [
            {
              $group: {
                _id: '$movementType',
                count: { $sum: 1 },
                totalQuantity: { $sum: '$quantity' },
                totalValue: { $sum: { $ifNull: ['$totalCost', 0] } },
              },
            },
            { $sort: { count: -1 } },
          ],
          dailyMovements: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$movementDate' },
                },
                count: { $sum: 1 },
                quantity: { $sum: '$quantity' },
              },
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
          ],
        },
      },
    ];

    const [result] = await this.movementModel.aggregate(pipeline as any).exec();

    return {
      summary: result.summary[0] || {
        totalMovements: 0,
        totalQuantityIn: 0,
        totalQuantityOut: 0,
        totalValue: 0,
      },
      movementTypes: result.movementTypes,
      dailyMovements: result.dailyMovements,
    };
  }

  async approveMovement(
    id: string,
    approvedBy: any,
    session?: ClientSession,
  ): Promise<InventoryMovement> {
    const movement = await this.movementModel.findById(id).session(session || null);

    if (!movement) {
      throw new NotFoundException('Movement record not found');
    }

    if (movement.status === 'approved') {
      throw new BadRequestException('Movement is already approved');
    }

    movement.status = 'approved';
    movement.approvedBy = approvedBy._id;
    movement.approvedDate = new Date();

    const updatedMovement = await movement.save({ session });

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.INVENTORY_ITEM,
      movement.inventoryItem.toString(),
      approvedBy,
      {
        description: `Approved inventory movement: ${movement.movementType}`,
        metadata: {
          movementId: movement._id.toString(),
          originalPerformedBy: movement.performedBy.toString(),
        },
        severity: 'medium',
      },
    );

    return updatedMovement;
  }

  async rejectMovement(
    id: string,
    rejectedBy: any,
    reason: string,
    session?: ClientSession,
  ): Promise<void> {
    const movement = await this.movementModel.findById(id).session(session || null);

    if (!movement) {
      throw new NotFoundException('Movement record not found');
    }

    if (movement.status !== 'pending') {
      throw new BadRequestException('Only pending movements can be rejected');
    }

    movement.status = 'rejected';
    movement.notes = movement.notes
      ? `${movement.notes}\n\nRejected: ${reason}`
      : `Rejected: ${reason}`;

    await movement.save({ session });

    await this.auditLogsService.logAction(
      AuditAction.UPDATE,
      AuditEntity.INVENTORY_ITEM,
      movement.inventoryItem.toString(),
      rejectedBy,
      {
        description: `Rejected inventory movement: ${movement.movementType}. Reason: ${reason}`,
        metadata: {
          movementId: movement._id.toString(),
          originalPerformedBy: movement.performedBy.toString(),
          rejectionReason: reason,
        },
        severity: 'high',
      },
    );
  }
}

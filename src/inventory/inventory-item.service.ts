import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, FilterQuery, Connection } from 'mongoose';
import {
  InventoryItem,
  InventoryItemDocument,
} from './schemas/inventory-item.schema';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import {
  InventoryStatus,
  InventoryMovementType,
} from '../common/enums/inventory.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../common/enums/audit-action.enum';

@Injectable()
export class InventoryItemService {
  constructor(
    @InjectModel(InventoryItem.name)
    private inventoryItemModel: Model<InventoryItemDocument>,
    private auditLogsService: AuditLogsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(
    createInventoryItemDto: CreateInventoryItemDto,
    createdBy: any,
  ): Promise<InventoryItem> {
    const existingItem = await this.inventoryItemModel.findOne({
      itemCode: createInventoryItemDto.itemCode,
    });

    if (existingItem) {
      throw new BadRequestException('Item code already exists');
    }

    if (createInventoryItemDto.barcode) {
      const existingBarcode = await this.inventoryItemModel.findOne({
        barcode: createInventoryItemDto.barcode,
      });

      if (existingBarcode) {
        throw new BadRequestException('Barcode already exists');
      }
    }

    const item = new this.inventoryItemModel({
      ...createInventoryItemDto,
      createdBy: createdBy._id,
    });

    const savedItem = await item.save();

    await this.auditLogsService.logAction(
      AuditAction.INVENTORY_ITEM_CREATED,
      AuditEntity.INVENTORY_ITEM,
      savedItem._id.toString(),
      createdBy,
      {
        description: `Created inventory item: ${savedItem.name}`,
        newValues: savedItem.toObject(),
        relatedUnit: savedItem.assignedUnit?.toString(),
        relatedDistrict: savedItem.assignedDistrict?.toString(),
      },
    );

    return savedItem;
  }

  async findAll(queryDto: InventoryQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      lowStock,
      outOfStock,
      nearExpiry,
      expiryDateStart,
      expiryDateEnd,
      ...filters
    } = queryDto;

    const query: FilterQuery<InventoryItemDocument> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query[key] = value;
      }
    });

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }

    if (lowStock) {
      query.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
    }

    if (outOfStock) {
      query.currentStock = { $lte: 0 };
    }

    if (nearExpiry) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      query.expiryDate = { $lte: thirtyDaysFromNow, $gte: new Date() };
    }

    if (expiryDateStart || expiryDateEnd) {
      query.expiryDate = {};
      if (expiryDateStart) query.expiryDate.$gte = new Date(expiryDateStart);
      if (expiryDateEnd) query.expiryDate.$lte = new Date(expiryDateEnd);
    }

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const [items, total] = await Promise.all([
      this.inventoryItemModel
        .find(query)
        .populate('category', 'name code type color')
        .populate('assignedUnit', 'name type')
        .populate('assignedDistrict', 'name type')
        .populate('createdBy', 'firstName lastName email')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.inventoryItemModel.countDocuments(query).exec(),
    ]);

    return {
      items,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        count: items.length,
        total,
      },
    };
  }

  async findOne(id: string): Promise<InventoryItem> {
    const item = await this.inventoryItemModel
      .findById(id)
      .populate('category', 'name code type color')
      .populate('assignedUnit', 'name type')
      .populate('assignedDistrict', 'name type')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .exec();

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  async update(
    id: string,
    updateData: Partial<CreateInventoryItemDto>,
    updatedBy: any,
  ): Promise<InventoryItem> {
    const item = await this.inventoryItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    const oldValues = item.toObject();

    if (updateData.itemCode && updateData.itemCode !== item.itemCode) {
      const existingItem = await this.inventoryItemModel.findOne({
        itemCode: updateData.itemCode,
        _id: { $ne: id },
      });

      if (existingItem) {
        throw new BadRequestException('Item code already exists');
      }
    }

    if (updateData.barcode && updateData.barcode !== item.barcode) {
      const existingBarcode = await this.inventoryItemModel.findOne({
        barcode: updateData.barcode,
        _id: { $ne: id },
      });

      if (existingBarcode) {
        throw new BadRequestException('Barcode already exists');
      }
    }

    Object.assign(item, updateData, {
      updatedBy: updatedBy._id,
      updatedAt: new Date(),
    });
    const savedItem = await item.save();

    await this.auditLogsService.logAction(
      AuditAction.INVENTORY_ITEM_UPDATED,
      AuditEntity.INVENTORY_ITEM,
      savedItem._id.toString(),
      updatedBy,
      {
        description: `Updated inventory item: ${savedItem.name}`,
        oldValues,
        newValues: savedItem.toObject(),
        relatedUnit: savedItem.assignedUnit?.toString(),
        relatedDistrict: savedItem.assignedDistrict?.toString(),
      },
    );

    return savedItem;
  }

  async remove(id: string, deletedBy: any): Promise<void> {
    const item = await this.inventoryItemModel.findById(id);

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    await this.inventoryItemModel.findByIdAndUpdate(id, {
      status: InventoryStatus.DISCONTINUED,
    });

    await this.auditLogsService.logAction(
      AuditAction.INVENTORY_ITEM_DELETED,
      AuditEntity.INVENTORY_ITEM,
      item._id.toString(),
      deletedBy,
      {
        description: `Discontinued inventory item: ${item.name}`,
        oldValues: item.toObject(),
        relatedUnit: item.assignedUnit?.toString(),
        relatedDistrict: item.assignedDistrict?.toString(),
      },
    );
  }

  async getLowStockItems(unitId?: string, districtId?: string) {
    const query: any = {
      status: InventoryStatus.ACTIVE,
      $expr: { $lte: ['$currentStock', '$reorderLevel'] },
    };

    if (unitId) query.assignedUnit = unitId;
    if (districtId) query.assignedDistrict = districtId;

    return this.inventoryItemModel
      .find(query)
      .populate('category', 'name code type')
      .populate('assignedUnit', 'name type')
      .populate('assignedDistrict', 'name type')
      .sort({ currentStock: 1 })
      .exec();
  }

  async getExpiringItems(
    days: number = 30,
    unitId?: string,
    districtId?: string,
  ) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const query: any = {
      status: InventoryStatus.ACTIVE,
      expiryDate: { $lte: futureDate, $gte: new Date() },
    };

    if (unitId) query.assignedUnit = unitId;
    if (districtId) query.assignedDistrict = districtId;

    return this.inventoryItemModel
      .find(query)
      .populate('category', 'name code type')
      .populate('assignedUnit', 'name type')
      .populate('assignedDistrict', 'name type')
      .sort({ expiryDate: 1 })
      .exec();
  }

  async getInventoryStatistics(unitId?: string, districtId?: string) {
    const matchStage: any = { status: InventoryStatus.ACTIVE };
    if (unitId) matchStage.assignedUnit = unitId;
    if (districtId) matchStage.assignedDistrict = districtId;

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalValue: {
                  $sum: { $multiply: ['$currentStock', '$unitCost'] },
                },
                lowStockItems: {
                  $sum: {
                    $cond: [{ $lte: ['$currentStock', '$reorderLevel'] }, 1, 0],
                  },
                },
                outOfStockItems: {
                  $sum: {
                    $cond: [{ $lte: ['$currentStock', 0] }, 1, 0],
                  },
                },
              },
            },
          ],
          categoryBreakdown: [
            {
              $group: {
                _id: '$category',
                itemCount: { $sum: 1 },
                totalValue: {
                  $sum: { $multiply: ['$currentStock', '$unitCost'] },
                },
              },
            },
            {
              $lookup: {
                from: 'inventory_categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryInfo',
              },
            },
            { $unwind: '$categoryInfo' },
            { $sort: { totalValue: -1 } },
          ],
        },
      },
    ];

    const [result] = await this.inventoryItemModel
      .aggregate(pipeline as any)
      .exec();

    return {
      summary: result.summary[0] || {
        totalItems: 0,
        totalValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      },
      categoryBreakdown: result.categoryBreakdown,
    };
  }

  async addStock(
    itemId: string,
    quantity: number,
    reason: string,
    performedBy: any,
    options: {
      unitCost?: number;
      referenceNumber?: string;
      batchNumber?: string;
      expiryDate?: Date;
      supplier?: string;
      supplierInvoiceNumber?: string;
      supplierInvoiceDate?: Date;
      receivedBy?: string;
      notes?: string;
    } = {},
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const item = await this.inventoryItemModel
        .findById(itemId)
        .session(session);
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      if (quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }

      const previousStock = item.currentStock;
      const newStock = previousStock + quantity;

      await this.inventoryItemModel.findByIdAndUpdate(
        itemId,
        {
          currentStock: newStock,
          lastStockCheck: new Date(),
          lastStockCheckedBy: performedBy._id,
          updatedBy: performedBy._id,
          updatedAt: new Date(),
        },
        { session },
      );

      // Create movement record using the InventoryMovement model directly
      const { InventoryMovement } = this.connection.models;
      const movement = new InventoryMovement({
        inventoryItem: itemId,
        movementType: InventoryMovementType.STOCK_IN,
        quantity,
        unitCost: options.unitCost,
        totalCost: options.unitCost ? options.unitCost * quantity : undefined,
        previousStock,
        newStock,
        reason,
        referenceNumber: options.referenceNumber,
        batchNumber: options.batchNumber,
        expiryDate: options.expiryDate,
        supplier: options.supplier,
        supplierInvoiceNumber: options.supplierInvoiceNumber,
        supplierInvoiceDate: options.supplierInvoiceDate,
        receivedBy: options.receivedBy,
        notes: options.notes,
        performedBy: performedBy._id,
        status: 'approved',
      });

      await movement.save({ session });

      await this.auditLogsService.logAction(
        AuditAction.INVENTORY_STOCK_ADDED,
        AuditEntity.INVENTORY_ITEM,
        itemId,
        performedBy,
        {
          description: `Added stock: ${quantity} units. ${reason}`,
          oldValues: { currentStock: previousStock },
          newValues: { currentStock: newStock },
          metadata: {
            movementId: movement._id.toString(),
            quantity,
            unitCost: options.unitCost,
            totalCost: movement.totalCost,
            referenceNumber: options.referenceNumber,
          },
          relatedUnit: item.assignedUnit?.toString(),
          relatedDistrict: item.assignedDistrict?.toString(),
        },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async removeStock(
    itemId: string,
    quantity: number,
    reason: string,
    movementType: InventoryMovementType,
    performedBy: any,
    options: {
      toUnit?: string;
      toDistrict?: string;
      referenceNumber?: string;
      notes?: string;
    } = {},
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const item = await this.inventoryItemModel
        .findById(itemId)
        .session(session);
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      if (quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }

      if (quantity > item.currentStock) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${item.currentStock}, Requested: ${quantity}`,
        );
      }

      const previousStock = item.currentStock;
      const newStock = previousStock - quantity;

      await this.inventoryItemModel.findByIdAndUpdate(
        itemId,
        {
          currentStock: newStock,
          lastStockCheck: new Date(),
          lastStockCheckedBy: performedBy._id,
          updatedBy: performedBy._id,
          updatedAt: new Date(),
        },
        { session },
      );

      // Create movement record using the InventoryMovement model directly
      const { InventoryMovement } = this.connection.models;
      const movement = new InventoryMovement({
        inventoryItem: itemId,
        movementType,
        quantity,
        previousStock,
        newStock,
        reason,
        fromUnit: item.assignedUnit,
        fromDistrict: item.assignedDistrict,
        toUnit: options.toUnit,
        toDistrict: options.toDistrict,
        referenceNumber: options.referenceNumber,
        notes: options.notes,
        performedBy: performedBy._id,
        status: 'approved',
      });

      await movement.save({ session });

      await this.auditLogsService.logAction(
        AuditAction.INVENTORY_STOCK_REMOVED,
        AuditEntity.INVENTORY_ITEM,
        itemId,
        performedBy,
        {
          description: `Removed stock: ${quantity} units (${movementType}). ${reason}`,
          oldValues: { currentStock: previousStock },
          newValues: { currentStock: newStock },
          metadata: {
            movementId: movement._id.toString(),
            movementType,
            quantity,
            referenceNumber: options.referenceNumber,
          },
          relatedUnit: item.assignedUnit?.toString(),
          relatedDistrict: item.assignedDistrict?.toString(),
        },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async adjustStock(
    itemId: string,
    newQuantity: number,
    reason: string,
    performedBy: any,
    options: {
      referenceNumber?: string;
      notes?: string;
    } = {},
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      const item = await this.inventoryItemModel
        .findById(itemId)
        .session(session);
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      if (newQuantity < 0) {
        throw new BadRequestException('New quantity cannot be negative');
      }

      const previousStock = item.currentStock;

      if (newQuantity === previousStock) {
        throw new BadRequestException(
          'New quantity is the same as current stock',
        );
      }

      await this.inventoryItemModel.findByIdAndUpdate(
        itemId,
        {
          currentStock: newQuantity,
          lastStockCheck: new Date(),
          lastStockCheckedBy: performedBy._id,
          updatedBy: performedBy._id,
          updatedAt: new Date(),
        },
        { session },
      );

      const adjustmentQuantity = Math.abs(newQuantity - previousStock);

      // Create movement record using the InventoryMovement model directly
      const { InventoryMovement } = this.connection.models;
      const movement = new InventoryMovement({
        inventoryItem: itemId,
        movementType: InventoryMovementType.ADJUSTMENT,
        quantity: adjustmentQuantity,
        previousStock,
        newStock: newQuantity,
        reason,
        referenceNumber: options.referenceNumber,
        notes: options.notes,
        performedBy: performedBy._id,
        status: 'approved',
      });

      await movement.save({ session });

      await this.auditLogsService.logAction(
        AuditAction.INVENTORY_ITEM_UPDATED,
        AuditEntity.INVENTORY_ITEM,
        itemId,
        performedBy,
        {
          description: `Stock adjustment: ${previousStock} → ${newQuantity} units. ${reason}`,
          oldValues: { currentStock: previousStock },
          newValues: { currentStock: newQuantity },
          metadata: {
            movementId: movement._id.toString(),
            movementType: InventoryMovementType.ADJUSTMENT,
            adjustmentQuantity,
            referenceNumber: options.referenceNumber,
          },
          severity: 'high',
          relatedUnit: item.assignedUnit?.toString(),
          relatedDistrict: item.assignedDistrict?.toString(),
        },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async transferStock(
    itemId: string,
    quantity: number,
    reason: string,
    fromUnit: string | undefined,
    fromDistrict: string | undefined,
    toUnit: string | undefined,
    toDistrict: string | undefined,
    performedBy: any,
    options: {
      referenceNumber?: string;
      notes?: string;
      receivedBy?: string;
    } = {},
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      session.startTransaction();

      if (!fromUnit && !fromDistrict) {
        throw new BadRequestException(
          'Either fromUnit or fromDistrict is required',
        );
      }

      if (!toUnit && !toDistrict) {
        throw new BadRequestException(
          'Either toUnit or toDistrict is required',
        );
      }

      await this.removeStock(
        itemId,
        quantity,
        reason,
        InventoryMovementType.TRANSFER,
        performedBy,
        {
          toUnit,
          toDistrict,
          referenceNumber: options.referenceNumber,
          notes: options.notes,
        },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

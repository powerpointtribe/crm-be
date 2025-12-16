import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryCategoryService } from './inventory-category.service';
import { InventoryItemService } from './inventory-item.service';
import { InventoryMovementService } from './inventory-movement.service';
import { InventoryCategoryController } from './inventory-category.controller';
import { InventoryItemController } from './inventory-item.controller';
import { InventoryMovementController } from './inventory-movement.controller';
import {
  InventoryCategory,
  InventoryCategorySchema,
} from './schemas/inventory-category.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from './schemas/inventory-item.schema';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from './schemas/inventory-movement.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CommonModule } from '../common/common.module';
import { InventoryMovementValidator } from './validators/inventory-movement.validator';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    RolesModule,
    MongooseModule.forFeature([
      { name: InventoryCategory.name, schema: InventoryCategorySchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryMovement.name, schema: InventoryMovementSchema },
    ]),
    AuditLogsModule,
    CommonModule,
  ],
  controllers: [
    InventoryCategoryController,
    InventoryItemController,
    InventoryMovementController,
  ],
  providers: [
    InventoryCategoryService,
    InventoryItemService,
    InventoryMovementService,
    InventoryMovementValidator,
  ],
  exports: [
    InventoryCategoryService,
    InventoryItemService,
    InventoryMovementService,
    InventoryMovementValidator,
  ],
})
export class InventoryModule {}

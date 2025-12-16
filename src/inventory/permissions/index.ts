/**
 * Inventory Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum InventoryPermission {
  // CREATE operations
  CREATE_ITEM = 'inventory:create-item',
  CREATE_CATEGORY = 'inventory:create-category',
  RECORD_MOVEMENT = 'inventory:record-movement',

  // READ operations
  VIEW_ITEMS = 'inventory:view-items',
  VIEW_ITEM_DETAILS = 'inventory:view-item-details',
  VIEW_CATEGORIES = 'inventory:view-categories',
  VIEW_CATEGORY_DETAILS = 'inventory:view-category-details',
  VIEW_CATEGORY_HIERARCHY = 'inventory:view-category-hierarchy',
  VIEW_MOVEMENTS = 'inventory:view-movements',
  VIEW_MOVEMENT_DETAILS = 'inventory:view-movement-details',
  VIEW_INVENTORY_STATS = 'inventory:view-stats',
  VIEW_LOW_STOCK = 'inventory:view-low-stock',
  VIEW_EXPIRING_ITEMS = 'inventory:view-expiring-items',
  VIEW_MOVEMENT_STATS = 'inventory:view-movement-stats',
  VIEW_MOVEMENT_CONSTRAINTS = 'inventory:view-movement-constraints',
  EXPORT_INVENTORY = 'inventory:export',

  // UPDATE operations
  UPDATE_ITEM = 'inventory:update-item',
  UPDATE_CATEGORY = 'inventory:update-category',
  ADJUST_STOCK = 'inventory:adjust-stock',
  UPDATE_ITEM_LOCATION = 'inventory:update-location',
  APPROVE_MOVEMENT = 'inventory:approve-movement',
  REJECT_MOVEMENT = 'inventory:reject-movement',

  // DELETE operations
  DELETE_ITEM = 'inventory:delete-item',
  DELETE_CATEGORY = 'inventory:delete-category',
  DELETE_MOVEMENT = 'inventory:delete-movement',

  // SPECIAL operations
  APPROVE_REQUISITION = 'inventory:approve-requisition',
  GENERATE_INVENTORY_REPORT = 'inventory:generate-report',
  CONDUCT_STOCK_AUDIT = 'inventory:conduct-audit',
}

export const InventoryPermissionMetadata = {
  [InventoryPermission.CREATE_ITEM]: {
    path: '/inventory/items',
    method: 'POST',
    description: 'Create a new inventory item',
  },
  [InventoryPermission.VIEW_ITEMS]: {
    path: '/inventory/items',
    method: 'GET',
    description: 'View all inventory items',
  },
  [InventoryPermission.UPDATE_ITEM]: {
    path: '/inventory/items/:id',
    method: 'PATCH',
    description: 'Update inventory item',
  },
  [InventoryPermission.DELETE_ITEM]: {
    path: '/inventory/items/:id',
    method: 'DELETE',
    description: 'Delete inventory item',
  },
};

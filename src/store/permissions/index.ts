export enum StorePermission {
  VIEW_PRODUCTS = 'store:view-products',
  CREATE_PRODUCT = 'store:create-product',
  UPDATE_PRODUCT = 'store:update-product',
  DELETE_PRODUCT = 'store:delete-product',
  VIEW_ORDERS = 'store:view-orders',
  UPDATE_ORDER = 'store:update-order',
  MANAGE_COUPONS = 'store:manage-coupons',
}

export const StorePermissionMetadata = {
  [StorePermission.VIEW_PRODUCTS]: {
    path: '/store/products',
    method: 'GET',
    description: 'View all store products',
  },
  [StorePermission.CREATE_PRODUCT]: {
    path: '/store/products',
    method: 'POST',
    description: 'Create a store product',
  },
  [StorePermission.UPDATE_PRODUCT]: {
    path: '/store/products/:id',
    method: 'PATCH',
    description: 'Update a store product',
  },
  [StorePermission.DELETE_PRODUCT]: {
    path: '/store/products/:id',
    method: 'DELETE',
    description: 'Delete a store product',
  },
  [StorePermission.VIEW_ORDERS]: {
    path: '/store/orders',
    method: 'GET',
    description: 'View all store orders',
  },
  [StorePermission.UPDATE_ORDER]: {
    path: '/store/orders/:id',
    method: 'PATCH',
    description: 'Update order status',
  },
};

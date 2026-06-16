/**
 * Finance Module Permissions
 * Centralized permission definitions for requisitions and expense management
 */

export enum FinancePermission {
  // Requisition - CREATE operations
  CREATE_REQUISITION = 'finance:create-requisition',

  // Grants eligibility to raise requisitions via the public form even when the
  // member is NOT LXL/leadership. Assign to a role to authorize specific members.
  RAISE_REQUISITION = 'finance:raise-requisition',

  // Requisition - READ operations
  VIEW_REQUISITIONS = 'finance:view-requisitions',
  VIEW_REQUISITION_DETAILS = 'finance:view-requisition-details',
  VIEW_MY_REQUISITIONS = 'finance:view-my-requisitions',
  VIEW_PENDING_APPROVALS = 'finance:view-pending-approvals',
  VIEW_PENDING_DISBURSEMENTS = 'finance:view-pending-disbursements',

  // Requisition - UPDATE operations
  UPDATE_REQUISITION = 'finance:update-requisition',

  // Requisition - WORKFLOW operations
  APPROVE_REQUISITION = 'finance:approve-requisition',
  REJECT_REQUISITION = 'finance:reject-requisition',
  DISBURSE = 'finance:disburse',
  RECEIVE_DISBURSE_CONFIRMATION = 'finance:receive-disburse-confirmation',

  // Requisition - DELETE operations
  DELETE_REQUISITION = 'finance:delete-requisition',

  // Expense Category operations
  VIEW_EXPENSE_CATEGORIES = 'finance:view-expense-categories',
  CREATE_EXPENSE_CATEGORY = 'finance:create-expense-category',
  UPDATE_EXPENSE_CATEGORY = 'finance:update-expense-category',
  DELETE_EXPENSE_CATEGORY = 'finance:delete-expense-category',
  MANAGE_EXPENSE_CATEGORIES = 'finance:manage-expense-categories',

  // Reporting operations
  VIEW_FINANCE_REPORTS = 'finance:view-reports',
  EXPORT_FINANCE_REPORTS = 'finance:export-reports',
  VIEW_FINANCE_DASHBOARD = 'finance:view-dashboard',

  // Form Field Configuration operations
  VIEW_FORM_FIELDS = 'finance:view-form-fields',
  MANAGE_FORM_FIELDS = 'finance:manage-form-fields',
}

export const FinancePermissionMetadata = {
  // Requisition endpoints
  [FinancePermission.CREATE_REQUISITION]: {
    path: '/finance/requisitions',
    method: 'POST',
    description: 'Create a new requisition request',
  },
  [FinancePermission.RAISE_REQUISITION]: {
    path: null,
    method: null,
    description:
      'Eligible to raise requisitions via the public form (in addition to LXL leaders)',
  },
  [FinancePermission.VIEW_REQUISITIONS]: {
    path: '/finance/requisitions',
    method: 'GET',
    description: 'View all requisitions',
  },
  [FinancePermission.VIEW_REQUISITION_DETAILS]: {
    path: '/finance/requisitions/:id',
    method: 'GET',
    description: 'View requisition details',
  },
  [FinancePermission.VIEW_MY_REQUISITIONS]: {
    path: '/finance/requisitions/my',
    method: 'GET',
    description: 'View own requisitions',
  },
  [FinancePermission.VIEW_PENDING_APPROVALS]: {
    path: '/finance/requisitions/pending-approval',
    method: 'GET',
    description: 'View requisitions pending approval',
  },
  [FinancePermission.VIEW_PENDING_DISBURSEMENTS]: {
    path: '/finance/requisitions/pending-disbursement',
    method: 'GET',
    description: 'View requisitions pending disbursement',
  },
  [FinancePermission.UPDATE_REQUISITION]: {
    path: '/finance/requisitions/:id',
    method: 'PATCH',
    description: 'Update a draft requisition',
  },
  [FinancePermission.APPROVE_REQUISITION]: {
    path: '/finance/requisitions/:id/approve',
    method: 'POST',
    description: 'Approve a requisition',
  },
  [FinancePermission.REJECT_REQUISITION]: {
    path: '/finance/requisitions/:id/reject',
    method: 'POST',
    description: 'Reject a requisition',
  },
  [FinancePermission.DISBURSE]: {
    path: '/finance/requisitions/:id/disburse',
    method: 'POST',
    description: 'Disburse funds for an approved requisition',
  },
  [FinancePermission.RECEIVE_DISBURSE_CONFIRMATION]: {
    path: null,
    method: null,
    description: 'Receive email notifications when requisitions are disbursed',
  },
  [FinancePermission.DELETE_REQUISITION]: {
    path: '/finance/requisitions/:id',
    method: 'DELETE',
    description: 'Delete a requisition',
  },

  // Expense Category endpoints
  [FinancePermission.VIEW_EXPENSE_CATEGORIES]: {
    path: '/finance/expense-categories',
    method: 'GET',
    description: 'View expense categories',
  },
  [FinancePermission.CREATE_EXPENSE_CATEGORY]: {
    path: '/finance/expense-categories',
    method: 'POST',
    description: 'Create a new expense category',
  },
  [FinancePermission.UPDATE_EXPENSE_CATEGORY]: {
    path: '/finance/expense-categories/:id',
    method: 'PATCH',
    description: 'Update an expense category',
  },
  [FinancePermission.DELETE_EXPENSE_CATEGORY]: {
    path: '/finance/expense-categories/:id',
    method: 'DELETE',
    description: 'Delete an expense category',
  },

  // Report endpoints
  [FinancePermission.VIEW_FINANCE_REPORTS]: {
    path: '/finance/reports/summary',
    method: 'GET',
    description: 'View finance reports and statistics',
  },
  [FinancePermission.EXPORT_FINANCE_REPORTS]: {
    path: '/finance/reports/export',
    method: 'GET',
    description: 'Export finance reports',
  },
  [FinancePermission.VIEW_FINANCE_DASHBOARD]: {
    path: '/finance/dashboard',
    method: 'GET',
    description: 'View finance dashboard',
  },

  // Form Field Configuration endpoints
  [FinancePermission.VIEW_FORM_FIELDS]: {
    path: '/finance/form-fields/:formType',
    method: 'GET',
    description: 'View form field configurations',
  },
  [FinancePermission.MANAGE_FORM_FIELDS]: {
    path: '/finance/form-fields',
    method: 'POST',
    description: 'Create, update, or delete form field configurations',
  },
};

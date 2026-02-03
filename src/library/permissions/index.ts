/**
 * Library Module Permissions
 * Centralized permission definitions tied to endpoints
 */

export enum LibraryPermission {
  // Book operations
  VIEW_BOOKS = 'library:view-books',
  CREATE_BOOK = 'library:create-book',
  UPDATE_BOOK = 'library:update-book',
  DELETE_BOOK = 'library:delete-book',

  // Category operations
  VIEW_CATEGORIES = 'library:view-categories',
  CREATE_CATEGORY = 'library:create-category',
  UPDATE_CATEGORY = 'library:update-category',
  DELETE_CATEGORY = 'library:delete-category',

  // Borrowing operations
  VIEW_BORROWINGS = 'library:view-borrowings',
  CREATE_BORROWING = 'library:create-borrowing',
  RETURN_BOOK = 'library:return-book',
  VIEW_OVERDUE = 'library:view-overdue',
  VIEW_MEMBER_HISTORY = 'library:view-member-history',

  // Statistics
  VIEW_STATS = 'library:view-stats',
}

/**
 * Permission metadata for endpoint mapping
 */
export const LibraryPermissionMetadata = {
  // Book permissions
  [LibraryPermission.VIEW_BOOKS]: {
    path: '/library/books',
    method: 'GET',
    description: 'View all books in the library',
  },
  [LibraryPermission.CREATE_BOOK]: {
    path: '/library/books',
    method: 'POST',
    description: 'Add a new book to the library',
  },
  [LibraryPermission.UPDATE_BOOK]: {
    path: '/library/books/:id',
    method: 'PATCH',
    description: 'Update book information',
  },
  [LibraryPermission.DELETE_BOOK]: {
    path: '/library/books/:id',
    method: 'DELETE',
    description: 'Remove a book from the library',
  },

  // Category permissions
  [LibraryPermission.VIEW_CATEGORIES]: {
    path: '/library/categories',
    method: 'GET',
    description: 'View all book categories',
  },
  [LibraryPermission.CREATE_CATEGORY]: {
    path: '/library/categories',
    method: 'POST',
    description: 'Create a new book category',
  },
  [LibraryPermission.UPDATE_CATEGORY]: {
    path: '/library/categories/:id',
    method: 'PATCH',
    description: 'Update a book category',
  },
  [LibraryPermission.DELETE_CATEGORY]: {
    path: '/library/categories/:id',
    method: 'DELETE',
    description: 'Delete a book category',
  },

  // Borrowing permissions
  [LibraryPermission.VIEW_BORROWINGS]: {
    path: '/library/borrowings',
    method: 'GET',
    description: 'View all borrowing records',
  },
  [LibraryPermission.CREATE_BORROWING]: {
    path: '/library/borrowings',
    method: 'POST',
    description: 'Issue a book to a member',
  },
  [LibraryPermission.RETURN_BOOK]: {
    path: '/library/borrowings/:id/return',
    method: 'PATCH',
    description: 'Process a book return',
  },
  [LibraryPermission.VIEW_OVERDUE]: {
    path: '/library/borrowings/overdue',
    method: 'GET',
    description: 'View overdue books',
  },
  [LibraryPermission.VIEW_MEMBER_HISTORY]: {
    path: '/library/borrowings/member/:memberId',
    method: 'GET',
    description: 'View member borrowing history',
  },

  // Statistics permissions
  [LibraryPermission.VIEW_STATS]: {
    path: '/library/statistics',
    method: 'GET',
    description: 'View library statistics',
  },
};

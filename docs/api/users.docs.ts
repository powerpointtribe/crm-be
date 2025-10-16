export const UsersDocs = {
  create: {
    operation: { summary: 'Create a new user' },
    responses: [
      { status: 201, description: 'User created successfully' },
      { status: 409, description: 'Email already registered' }
    ]
  },
  findAll: {
    operation: { summary: 'Get all users with pagination and search' },
    responses: [
      { status: 200, description: 'Users retrieved successfully' }
    ]
  },
  getUserStats: {
    operation: { summary: 'Get user statistics' },
    responses: [
      { status: 200, description: 'User stats retrieved successfully' }
    ]
  },
  getProfile: {
    operation: { summary: 'Get current user profile' },
    responses: [
      { status: 200, description: 'Profile retrieved successfully' }
    ]
  },
  findOne: {
    operation: { summary: 'Get user by ID' },
    param: { name: 'id', description: 'User ID' },
    responses: [
      { status: 200, description: 'User retrieved successfully' },
      { status: 404, description: 'User not found' }
    ]
  },
  update: {
    operation: { summary: 'Update user by ID' },
    param: { name: 'id', description: 'User ID' },
    responses: [
      { status: 200, description: 'User updated successfully' },
      { status: 404, description: 'User not found' }
    ]
  },
  deactivate: {
    operation: { summary: 'Deactivate user' },
    param: { name: 'id', description: 'User ID' },
    responses: [
      { status: 200, description: 'User deactivated successfully' }
    ]
  },
  activate: {
    operation: { summary: 'Activate user' },
    param: { name: 'id', description: 'User ID' },
    responses: [
      { status: 200, description: 'User activated successfully' }
    ]
  },
  remove: {
    operation: { summary: 'Delete user' },
    param: { name: 'id', description: 'User ID' },
    responses: [
      { status: 204, description: 'User deleted successfully' }
    ]
  }
};
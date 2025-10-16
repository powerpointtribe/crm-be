import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export const AuthDocs = {
  login: {
    operation: { summary: 'User login' },
    responses: [
      { status: 200, description: 'Login successful' },
      { status: 401, description: 'Invalid credentials' }
    ]
  },
  register: {
    operation: { summary: 'User registration' },
    responses: [
      { status: 201, description: 'Registration successful' },
      { status: 409, description: 'Email already registered' }
    ]
  },
  getProfile: {
    operation: { summary: 'Get current user profile' },
    responses: [
      { status: 200, description: 'Profile retrieved successfully' }
    ]
  }
};
export const FirstTimersDocs = {
  createPublic: {
    operation: { summary: 'Register a new first-time visitor (Public endpoint)' },
    tags: ['Public API'],
    responses: [
      { status: 201, description: 'First-timer registered successfully from public domain' },
      { status: 400, description: 'Invalid input data' }
    ]
  },
  create: {
    operation: { summary: 'Register a new first-time visitor' },
    responses: [
      { status: 201, description: 'First-timer registered successfully' },
      { status: 409, description: 'Phone or email already registered' }
    ]
  },
  findAll: {
    operation: { summary: 'Get all first-timers with advanced filtering' },
    responses: [
      { status: 200, description: 'First-timers retrieved successfully' }
    ]
  },
  getFirstTimerStats: {
    operation: { summary: 'Get first-timer statistics and analytics' },
    responses: [
      { status: 200, description: 'First-timer stats retrieved successfully' }
    ]
  },
  getNeedingFollowUp: {
    operation: { summary: 'Get first-timers needing follow-up' },
    responses: [
      { status: 200, description: 'First-timers needing follow-up retrieved successfully' }
    ]
  },
  getRecentVisitors: {
    operation: { summary: 'Get recent visitors' },
    query: {
      name: 'days',
      required: false,
      description: 'Number of days to look back (default: 7)'
    },
    responses: [
      { status: 200, description: 'Recent visitors retrieved successfully' }
    ]
  },
  getMyAssignments: {
    operation: { summary: 'Get first-timers assigned to current user' },
    responses: [
      { status: 200, description: 'Assigned first-timers retrieved successfully' }
    ]
  },
  findOne: {
    operation: { summary: 'Get first-timer by ID' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'First-timer retrieved successfully' },
      { status: 404, description: 'First-timer not found' }
    ]
  },
  addFollowUp: {
    operation: { summary: 'Add follow-up record to first-timer' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'Follow-up added successfully' }
    ]
  },
  updateStatus: {
    operation: { summary: 'Update first-timer engagement status' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'Status updated successfully' }
    ]
  },
  assignToMember: {
    operation: { summary: 'Assign first-timer to a follow-up team member' },
    params: [
      { name: 'id', description: 'First-timer ID' },
      { name: 'memberId', description: 'Member ID to assign to' }
    ],
    responses: [
      { status: 200, description: 'First-timer assigned successfully' }
    ]
  },
  convertToMember: {
    operation: { summary: 'Convert first-timer to member' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'First-timer converted to member successfully' }
    ]
  },
  assignFollowUp: {
    operation: { summary: 'Assign follow-up person to first-timer' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'Follow-up person assigned successfully' }
    ]
  },
  getPendingDistrictAssignments: {
    operation: { summary: 'Get first-timers pending district assignment' },
    responses: [
      { status: 200, description: 'Pending district assignments retrieved successfully' }
    ]
  },
  updateNotes: {
    operation: { summary: 'Update first-timer notes' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'Notes updated successfully' }
    ]
  },
  deactivate: {
    operation: { summary: 'Deactivate first-timer record' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 200, description: 'First-timer deactivated successfully' }
    ]
  },
  remove: {
    operation: { summary: 'Delete first-timer (super admin only)' },
    param: { name: 'id', description: 'First-timer ID' },
    responses: [
      { status: 204, description: 'First-timer deleted successfully' },
      { status: 404, description: 'First-timer not found' }
    ]
  },
  bulkAssign: {
    operation: { summary: 'Bulk assign first-timers to users' },
    responses: [
      { status: 200, description: 'Bulk assignment completed successfully' }
    ]
  },
  bulkUpdateStatus: {
    operation: { summary: 'Bulk update status for multiple first-timers' },
    responses: [
      { status: 200, description: 'Bulk status update completed successfully' }
    ]
  },
  bulkUpload: {
    operation: { summary: 'Queue bulk upload first-timers from CSV file' },
    consumes: 'multipart/form-data',
    body: {
      description: 'CSV file with first-timer data',
      schema: {
        type: 'object',
        properties: {
          file: { type: 'string', format: 'binary' },
          skipErrors: {
            type: 'boolean',
            description: 'Whether to skip validation errors and continue with valid records',
            default: false
          },
          defaultAssignedTo: {
            type: 'string',
            description: 'Default assignee for all first-timers in the upload'
          }
        }
      }
    },
    responses: [
      {
        status: 202,
        description: 'Bulk upload job queued successfully',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                status: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        }
      },
      { status: 400, description: 'Invalid file format or content' }
    ]
  },
  getSampleCSV: {
    operation: { summary: 'Download sample CSV template for bulk upload' },
    responses: [
      { status: 200, description: 'Sample CSV template downloaded successfully' }
    ]
  }
};
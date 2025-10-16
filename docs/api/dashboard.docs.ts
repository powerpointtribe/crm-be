export const DashboardDocs = {
  getAccessibleModules: {
    operation: { summary: 'Get accessible modules for current user' }
  },
  getDashboardOverview: {
    operation: { summary: 'Get dashboard overview with key metrics and statistics' },
    responses: [
      { status: 200, description: 'Dashboard overview retrieved successfully' },
      { status: 401, description: 'Unauthorized - User not authenticated' },
      { status: 403, description: 'Forbidden - Insufficient permissions' }
    ]
  },
  getFirstTimers: {
    operation: { summary: 'Get first timers data' }
  },
  getMembers: {
    operation: { summary: 'Get members data' }
  },
  getFinances: {
    operation: { summary: 'Get financial data' }
  },
  getSystemSettings: {
    operation: { summary: 'Get system settings' }
  },
  getDetailedStats: {
    operation: { summary: 'Get detailed statistics (admin only)' },
    query: {
      name: 'period',
      required: false,
      description: 'Time period for statistics'
    },
    responses: [
      { status: 200, description: 'Statistics retrieved successfully' }
    ]
  },
  getActivityFeed: {
    operation: { summary: 'Get recent activity feed' },
    query: {
      name: 'limit',
      required: false,
      type: 'Number',
      description: 'Number of activities to retrieve (default: 20)'
    },
    responses: [
      { status: 200, description: 'Activity feed retrieved successfully' }
    ]
  },
  getPendingTasks: {
    operation: { summary: 'Get pending tasks and notifications' },
    responses: [
      { status: 200, description: 'Tasks retrieved successfully' }
    ]
  },
  getQuickStats: {
    operation: { summary: 'Get quick stats for header/sidebar display' },
    responses: [
      { status: 200, description: 'Quick stats retrieved successfully' }
    ]
  },
  getGrowthAnalytics: {
    operation: {
      summary: 'Get growth analytics and trends data',
      description: 'Returns comprehensive growth analytics including member, first-timer, and group growth metrics with historical data'
    },
    query: {
      name: 'period',
      required: false,
      description: 'Time period for analytics analysis'
    },
    responses: [
      { status: 200, description: 'Growth analytics retrieved successfully' }
    ]
  },
  getRecentActivity: {
    operation: {
      summary: 'Get recent activity analytics',
      description: 'Returns detailed recent activity analytics including activity trends, most active users, and activity summaries'
    },
    queries: [
      {
        name: 'limit',
        required: false,
        type: 'Number',
        description: 'Number of activities to retrieve (default: 50)'
      },
      {
        name: 'days',
        required: false,
        type: 'Number',
        description: 'Number of days to analyze (default: 7)'
      }
    ],
    responses: [
      { status: 200, description: 'Recent activity analytics retrieved successfully' }
    ]
  },
  getDemographics: {
    operation: {
      summary: 'Get member demographics analytics',
      description: 'Returns comprehensive demographic analysis including age, gender, marital status, and geographic distributions'
    },
    responses: [
      { status: 200, description: 'Demographics analytics retrieved successfully' }
    ]
  }
};
# Dashboard API Endpoints

This document describes the dashboard API endpoints for the Church Management System frontend.

## Base URL
```
http://localhost:3000/api/v1/dashboard
```

## Available Endpoints

### 1. Dashboard Overview
**GET** `/api/v1/dashboard/overview`

Returns comprehensive dashboard data for the overview page.

**Authentication:** Required (JWT Bearer Token)

**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP, FOLLOW_UP_TEAM, GROUP_LEADER

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalMembers": 1250,
      "activeMembers": 1180,
      "totalFirstTimers": 45,
      "totalUsers": 12,
      "totalGroups": 8
    },
    "recentActivity": {
      "recentMembers": {
        "count": 15,
        "percentage": 25,
        "trend": "up"
      },
      "recentFirstTimers": {
        "count": 8,
        "percentage": -10,
        "trend": "down"
      },
      "recentGroups": {
        "count": 2,
        "percentage": 0,
        "trend": "stable"
      }
    },
    "membershipTrends": {
      "monthlyGrowth": [
        {
          "month": "Jul",
          "members": 12,
          "firstTimers": 5
        },
        {
          "month": "Aug",
          "members": 18,
          "firstTimers": 8
        }
      ],
      "ageDistribution": [
        {
          "ageGroup": "Young Adults (26-35)",
          "count": 450,
          "percentage": 36
        },
        {
          "ageGroup": "Adults (36-50)",
          "count": 380,
          "percentage": 30
        }
      ],
      "genderDistribution": [
        {
          "gender": "female",
          "count": 670,
          "percentage": 54
        },
        {
          "gender": "male",
          "count": 580,
          "percentage": 46
        }
      ]
    },
    "upcomingTasks": {
      "pendingFollowUps": [
        {
          "id": "64f8b123456789abcdef0123",
          "name": "John Doe",
          "type": "first-timer",
          "daysOverdue": 5,
          "assignedTo": "64f8b123456789abcdef0456"
        }
      ],
      "recentBulkOperations": [
        {
          "id": "12345",
          "type": "BULK_MEMBER_CREATE",
          "status": "completed",
          "processedCount": 150,
          "totalCount": 150,
          "createdAt": "2024-01-15T10:30:00.000Z"
        }
      ]
    },
    "userRole": "PASTOR",
    "lastUpdated": "2024-01-15T15:30:00.000Z"
  },
  "message": "Dashboard overview retrieved successfully"
}
```

### 2. Detailed Statistics
**GET** `/api/v1/dashboard/stats?period=month`

Returns detailed statistics for admin users.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP

**Query Parameters:**
- `period` (optional): `week` | `month` | `quarter` | `year` (default: `month`)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "stats": { /* Same as overview stats */ },
    "trends": { /* Same as overview trends */ },
    "activity": { /* Same as overview activity */ }
  },
  "message": "month statistics retrieved successfully"
}
```

### 3. Activity Feed
**GET** `/api/v1/dashboard/activity?limit=20`

Returns recent activity feed.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP, FOLLOW_UP_TEAM, GROUP_LEADER

**Query Parameters:**
- `limit` (optional): Number of activities to retrieve (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": { /* UpcomingTasks object */ },
    "recentActivity": { /* RecentActivity object */ },
    "limit": 20
  },
  "message": "Activity feed retrieved successfully"
}
```

### 4. Pending Tasks
**GET** `/api/v1/dashboard/tasks`

Returns pending tasks and notifications.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP, FOLLOW_UP_TEAM, GROUP_LEADER

**Response:**
```json
{
  "success": true,
  "data": {
    "pendingFollowUps": [ /* Array of pending follow-ups */ ],
    "recentBulkOperations": [ /* Array of recent bulk operations */ ]
  },
  "message": "Pending tasks retrieved successfully"
}
```

### 5. Quick Stats
**GET** `/api/v1/dashboard/quick-stats`

Returns quick stats for header/sidebar display.

**Authentication:** Required
**Roles:** All authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMembers": 1250,
    "totalFirstTimers": 45,
    "pendingFollowUps": 5,
    "userRole": "PASTOR"
  },
  "message": "Quick stats retrieved successfully"
}
```

### 6. Growth Analytics
**GET** `/api/v1/dashboard/growth-analytics?period=month`

Returns comprehensive growth analytics including member, first-timer, and group growth metrics with historical data.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP

**Query Parameters:**
- `period` (optional): `week` | `month` | `quarter` | `year` (default: `month`)

**Response:**
```json
{
  "success": true,
  "data": {
    "memberGrowth": {
      "current": 1250,
      "previous": 1200,
      "percentageChange": 4.17,
      "trend": "up",
      "netChange": 50
    },
    "firstTimerGrowth": {
      "current": 45,
      "previous": 38,
      "percentageChange": 18.42,
      "trend": "up",
      "netChange": 7
    },
    "groupGrowth": {
      "current": 8,
      "previous": 7,
      "percentageChange": 14.29,
      "trend": "up",
      "netChange": 1
    },
    "userGrowth": {
      "current": 12,
      "previous": 10,
      "percentageChange": 20.0,
      "trend": "up",
      "netChange": 2
    },
    "monthlyData": [
      {
        "month": "September",
        "year": 2024,
        "members": 45,
        "firstTimers": 12,
        "groups": 1,
        "totalGrowth": 58
      },
      {
        "month": "October",
        "year": 2024,
        "members": 50,
        "firstTimers": 7,
        "groups": 0,
        "totalGrowth": 57
      }
    ],
    "period": "month",
    "dateRange": {
      "start": "2024-09-01T00:00:00.000Z",
      "end": "2024-10-31T23:59:59.999Z"
    }
  },
  "message": "Growth analytics for month retrieved successfully"
}
```

### 7. Recent Activity Analytics
**GET** `/api/v1/dashboard/recent-activity?limit=50&days=7`

Returns detailed recent activity analytics including activity trends, most active users, and activity summaries.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP, FOLLOW_UP_TEAM, GROUP_LEADER

**Query Parameters:**
- `limit` (optional): Number of activities to retrieve (default: 50)
- `days` (optional): Number of days to analyze (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity_123",
        "type": "member_joined",
        "description": "John Smith joined as a new member",
        "performer": {
          "id": "user_456",
          "name": "Pastor Mike",
          "role": "PASTOR"
        },
        "timestamp": "2024-10-06T14:30:00.000Z",
        "entityData": {
          "id": "member_789",
          "name": "John Smith",
          "type": "member"
        },
        "metadata": {
          "district": "North District",
          "unit": "Unit A"
        }
      }
    ],
    "summary": {
      "totalActivities": 125,
      "memberActivities": 45,
      "firstTimerActivities": 23,
      "groupActivities": 8,
      "userActivities": 5,
      "bulkOperations": 44
    },
    "trends": {
      "todayCount": 15,
      "yesterdayCount": 18,
      "weekCount": 125,
      "monthCount": 480
    },
    "mostActiveUsers": [
      {
        "userId": "user_456",
        "userName": "Pastor Mike",
        "activityCount": 45,
        "lastActivity": "2024-10-06T16:45:00.000Z"
      },
      {
        "userId": "user_789",
        "userName": "Sister Sarah",
        "activityCount": 32,
        "lastActivity": "2024-10-06T15:20:00.000Z"
      }
    ],
    "period": "last 7 days",
    "lastUpdated": "2024-10-06T17:00:00.000Z"
  },
  "message": "Recent activity analytics retrieved successfully"
}
```

### 8. Demographics Analytics
**GET** `/api/v1/dashboard/demographics`

Returns comprehensive demographic analysis including age, gender, marital status, and geographic distributions.

**Authentication:** Required
**Roles:** SUPER_ADMIN, PASTOR, LEADERSHIP

**Response:**
```json
{
  "success": true,
  "data": {
    "ageDistribution": [
      {
        "ageGroup": "Young Adults (18-25)",
        "count": 280,
        "percentage": 22.4,
        "growth": 5.2
      },
      {
        "ageGroup": "Adults (26-35)",
        "count": 450,
        "percentage": 36.0,
        "growth": 2.8
      },
      {
        "ageGroup": "Middle Age (36-50)",
        "count": 380,
        "percentage": 30.4,
        "growth": 1.5
      },
      {
        "ageGroup": "Seniors (51+)",
        "count": 140,
        "percentage": 11.2,
        "growth": -1.2
      }
    ],
    "genderDistribution": [
      {
        "gender": "Female",
        "count": 670,
        "percentage": 53.6,
        "growth": 3.1
      },
      {
        "gender": "Male",
        "count": 580,
        "percentage": 46.4,
        "growth": 2.9
      }
    ],
    "maritalStatusDistribution": [
      {
        "status": "Single",
        "count": 625,
        "percentage": 50.0
      },
      {
        "status": "Married",
        "count": 500,
        "percentage": 40.0
      },
      {
        "status": "Divorced",
        "count": 75,
        "percentage": 6.0
      },
      {
        "status": "Widowed",
        "count": 50,
        "percentage": 4.0
      }
    ],
    "geographicDistribution": [
      {
        "location": "Lagos State",
        "count": 850,
        "percentage": 68.0,
        "type": "state"
      },
      {
        "location": "Abuja FCT",
        "count": 200,
        "percentage": 16.0,
        "type": "state"
      },
      {
        "location": "Ikeja",
        "count": 320,
        "percentage": 25.6,
        "type": "city"
      },
      {
        "location": "Victoria Island",
        "count": 180,
        "percentage": 14.4,
        "type": "city"
      }
    ],
    "totalMembers": 1250,
    "analysisDate": "2024-10-06T17:00:00.000Z"
  },
  "message": "Demographics analytics retrieved successfully"
}
```

## Frontend Integration

### For React/Vue/Angular Applications

```javascript
// Example: Fetch dashboard overview
const fetchDashboardOverview = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/dashboard/overview', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      return data.data; // Dashboard overview data
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    throw error;
  }
};

// Example: Fetch quick stats for header
const fetchQuickStats = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/dashboard/quick-stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Failed to fetch quick stats:', error);
  }
};
```

### Axios Example

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Fetch dashboard overview
const getDashboardOverview = () => api.get('/dashboard/overview');

// Fetch activity feed
const getActivityFeed = (limit = 20) =>
  api.get(`/dashboard/activity?limit=${limit}`);

// Fetch pending tasks
const getPendingTasks = () => api.get('/dashboard/tasks');
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information",
  "statusCode": 400
}
```

Common HTTP status codes:
- `200` - Success
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Internal server error

## Role-Based Access

Different roles have access to different endpoints:

- **All Authenticated Users**: `quick-stats`
- **GROUP_LEADER+**: `overview`, `activity`, `tasks`
- **LEADERSHIP+**: `stats` (detailed statistics)

Make sure to handle role-based UI rendering on the frontend based on the `userRole` field returned in responses.
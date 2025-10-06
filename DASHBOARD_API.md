# Dashboard API Endpoints

This document describes the dashboard API endpoints for the Church Management System frontend.

## Base URL
```
http://localhost:3000/dashboard
```

## Available Endpoints

### 1. Dashboard Overview
**GET** `/dashboard/overview`

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
**GET** `/dashboard/stats?period=month`

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
**GET** `/dashboard/activity?limit=20`

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
**GET** `/dashboard/tasks`

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
**GET** `/dashboard/quick-stats`

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

## Frontend Integration

### For React/Vue/Angular Applications

```javascript
// Example: Fetch dashboard overview
const fetchDashboardOverview = async () => {
  try {
    const response = await fetch('http://localhost:3000/dashboard/overview', {
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
    const response = await fetch('http://localhost:3000/dashboard/quick-stats', {
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
  baseURL: 'http://localhost:3000',
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
# Church Management System - Backend

A comprehensive church management system built with NestJS, MongoDB, and Redis. This system handles member management, first-timer tracking, service reports, inventory, role-based access control, and more.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Seeding Data](#seeding-data)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Role-Based Access Control](#role-based-access-control)

## Features

- **Member Management**: Full CRUD operations, bulk imports, birthday tracking, location assignments
- **First-Timer Tracking**: Registration, follow-up workflow, integration pipeline, call reports
- **Service Reports**: Attendance tracking, analytics, PDF generation
- **Groups Management**: Districts, Units, Ministries, Fellowships with hierarchical leadership
- **Inventory Management**: Item tracking, stock movements, categories
- **Role-Based Access Control (RBAC)**: Granular permissions, role hierarchy, scoped access
- **Multi-Branch Support**: Branch-scoped data and permissions
- **Audit Logging**: Track all system changes
- **Queue System**: Background job processing with Bull/Redis
- **Email Notifications**: SendGrid integration for transactional emails

## Tech Stack

- **Framework**: NestJS 10.x
- **Database**: MongoDB with Mongoose ODM
- **Cache/Queue**: Redis with Bull
- **Authentication**: JWT with Passport
- **Email**: SendGrid
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest

## Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x
- npm or yarn

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd church-management-system-backend

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/church-management

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS_ENABLED=false

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# SendGrid (Email)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourchurch.com
SENDGRID_FROM_NAME=Your Church Name

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173

# Super Admin (Initial Setup)
SUPER_ADMIN_EMAIL=admin@yourchurch.com
SUPER_ADMIN_PASSWORD=SecurePassword123!
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin
```

## Database Setup

### MongoDB Setup

```bash
# Start MongoDB (if using local installation)
mongod --dbpath /path/to/data

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### Redis Setup

```bash
# Start Redis (if using local installation)
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:7
```

## Running the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3001`

## Seeding Data

### Initialize Super Admin

The system requires an initial super admin user. Run:

```bash
npm run seed:admin
```

This creates:
- Super Admin user with all permissions
- Default roles (Admin, Pastor, District Pastor, Unit Head, Member)
- All system permissions

### Seed Sample Data (Development)

```bash
# Seed branches, groups, and sample members
npm run seed:data

# Seed all (admin + sample data)
npm run seed:all
```

## API Documentation

Swagger documentation is available at:
- Development: `http://localhost:3001/api/docs`

### Key API Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /auth/login` | User login |
| Auth | `POST /auth/forgot-password` | Password reset |
| Members | `GET /members` | List members |
| Members | `POST /members/bulk-upload` | Bulk import members |
| First-Timers | `GET /first-timers` | List first-timers |
| First-Timers | `POST /first-timers/:id/integrate` | Integrate to member |
| Groups | `GET /groups` | List groups |
| Service Reports | `GET /service-reports` | List service reports |
| Inventory | `GET /inventory` | List inventory items |
| Roles | `GET /roles` | List roles |
| Branches | `GET /branches` | List branches |

## Architecture

### Directory Structure

```
src/
├── auth/                 # Authentication module
├── members/              # Member management
├── first-timers/         # First-timer tracking
├── groups/               # Groups (Districts, Units, etc.)
├── branches/             # Multi-branch support
├── roles/                # RBAC system
├── service-reports/      # Service attendance reports
├── inventory/            # Inventory management
├── audit-logs/           # System audit logging
├── notifications/        # Email notifications
├── queue/                # Background job processing
├── common/               # Shared utilities, enums, guards
│   ├── enums/
│   ├── guards/
│   ├── decorators/
│   └── interceptors/
└── scripts/              # Database scripts and seeders
```

### Data Models

#### Member
- Personal info (name, email, phone, DOB, gender)
- Church info (branch, district, unit, membership status)
- Role assignment (single role with permissions)
- Leadership positions (district pastor, unit head)

#### Group Types
- `DISTRICT`: Home cell groups (mandatory for members)
- `UNIT`: Departments (optional)
- `MINISTRY`: Ministry groups
- `FELLOWSHIP`: Additional fellowships
- `COMMITTEE`: Committee groups

#### Membership Status Hierarchy
1. `MEMBER` - Regular member
2. `DC` - David's Company
3. `LXL` - League of Extraordinary Leaders
4. `DIRECTOR` - Director
5. `PASTOR` - Associate Pastor
6. `CAMPUS_PASTOR` - Campus Expression Pastor
7. `SENIOR_PASTOR` - Senior Pastor

## Role-Based Access Control

### Permission Structure

Permissions follow the format: `module:action`

Examples:
- `members:create` - Create new members
- `members:read` - View members
- `members:update` - Edit members
- `members:delete` - Delete members
- `groups:manage` - Manage groups
- `service-reports:create` - Create service reports

### Default Roles

| Role | Level | Key Permissions |
|------|-------|-----------------|
| Super Admin | 100 | All permissions |
| Admin | 90 | Most permissions except system config |
| Senior Pastor | 80 | Full read/write on church data |
| Campus Pastor | 70 | Branch-scoped full access |
| District Pastor | 50 | District-scoped management |
| Unit Head | 40 | Unit-scoped management |
| Member | 10 | Basic read access |

### Scoped Access

Access can be scoped to:
- **Global**: Access all data
- **Branch**: Access data within assigned branch
- **District**: Access data within assigned district(s)
- **Unit**: Access data within assigned unit

## Scripts

```bash
# Initialize super admin
npm run seed:admin

# Sync permissions for super admin
npx ts-node src/scripts/sync-super-admin-permissions.ts

# Run database migrations
npm run migrate
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Deployment

### Environment Considerations

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure Redis with TLS if remote
4. Set up MongoDB replica set for high availability
5. Configure rate limiting
6. Enable CORS for your frontend domain

### Docker Deployment

```bash
# Build image
docker build -t church-management-backend .

# Run container
docker run -p 3001:3001 --env-file .env church-management-backend
```

## License

MIT License

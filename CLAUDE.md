# Church Management System - Backend API

This file provides comprehensive guidance for Claude Code and developers working with this NestJS-based church management system.

## Project Overview

**Type**: NestJS 11 REST API with MongoDB, Redis, and TypeScript
**Purpose**: Comprehensive church management system handling members, first-timers, events, finance, inventory, library, and more
**API Prefix**: `/api/v1`
**Total Modules**: 27 feature modules
**Total Lines**: ~70,409 lines of code

**Tech Stack:**
- NestJS 11.x + TypeScript
- MongoDB 8.18.2 with Mongoose ODM
- Redis + Bull queues for background jobs
- JWT authentication with Passport
- Cloudinary for file uploads
- Multi-provider email system (SendGrid, Resend, ZeptoMail, Nodemailer)

---

## Quick Start

```bash
# Install dependencies
npm install

# Run in development (hot reload)
npm run start:dev

# Build for production
npm run build

# Run production
npm run start:prod

# Run tests
npm test

# Seed database
npm run seed:admin    # Create super admin + default roles
npm run seed:data     # Sample data (branches, groups, members)
npm run seed:all      # Run both seeders
```

### Environment Setup

Create `.env` file:

```env
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=church_management

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS_ENABLED=false

# Cloudinary (file uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email (configure at least one)
SENDGRID_API_KEY=
RESEND_API_KEY=
ZEPTOMAIL_API_KEY=
SMTP_HOST=
SMTP_PORT=587

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Application
APP_NAME=Church Management System
FRONTEND_URL=http://localhost:5173
```

---

## Architecture

### Module Structure

Every feature module follows this pattern:

```
src/feature-name/
├── feature-name.module.ts          # NestJS module definition
├── feature-name.controller.ts      # HTTP endpoints & routing
├── feature-name.service.ts         # Business logic
├── schemas/
│   └── feature.schema.ts           # Mongoose schema
├── dto/
│   ├── create-feature.dto.ts       # Create request validation
│   ├── update-feature.dto.ts       # Update request validation
│   └── search-feature.dto.ts       # Query/filter validation
└── permissions/
    └── index.ts                    # Module-specific permissions
```

### Key Modules

**Core Modules:**
- `auth` - JWT authentication, login, password reset
- `roles` - RBAC role management
- `members` - Member CRUD, analytics, bulk operations
- `groups` - Districts, Units, Ministries management
- `branches` - Multi-branch church support

**Feature Modules:**
- `first-timers` - Visitor tracking & follow-up workflows
- `service-reports` - Service attendance reporting
- `events` - Event management & registration
- `finance` - Requisition system with approval workflows
- `inventory` - Asset & stock management
- `library` - Book borrowing system
- `bulk-email` - Email campaigns & templates
- `workers-training` - Cohort-based training management
- `attendance` - ✨ **NEW**: Service attendance tracking
- `ministries` - ✨ **NEW**: Ministry management
- `units` - ✨ **NEW**: Unit management with leader validation

**Infrastructure Modules:**
- `queue` - Bull queue management & processors
- `notifications` - Multi-provider email system
- `audit-logs` - System-wide audit trail
- `activity-tracker` - Member lifecycle tracking
- `bull-board` - Queue monitoring dashboard
- `upload` - Cloudinary file uploads
- `entry-import` - CSV import handlers
- `bulk-operations` - Batch processing
- `user-invitations` - Invitation-based user onboarding
- `dashboard` - Analytics & reporting

---

## Authentication & Authorization

### JWT Authentication

Protected endpoints require JWT token:

```http
Authorization: Bearer <token>
```

Get token from:
```http
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

### Permission System (RBAC)

**Permission Format**: `module:action`

Examples:
- `members:view` - View members
- `members:create` - Create members
- `first-timers:assign` - Assign first-timers for follow-up
- `finance:approve` - Approve requisitions
- `attendance:record` - ✨ Record attendance

**Defining Permissions**:

```typescript
// In src/feature/permissions/index.ts
export enum FeaturePermission {
  VIEW_FEATURE = 'feature:view',
  CREATE_FEATURE = 'feature:create',
  // ...
}
```

**Using in Controllers**:

```typescript
import { RequirePermission } from '@/common/decorators/permission.decorator';

@Get()
@RequirePermission('feature:view')
findAll() { }

// For multiple permissions (any)
@RequireAnyPermission(['feature:view', 'feature:manage'])
findAll() { }

// For multiple permissions (all required)
@RequireAllPermissions(['feature:create', 'feature:approve'])
createAndApprove() { }
```

### Role Hierarchy

Roles have numeric levels (higher = more power):

1. **Super Admin** (100) - Full system access
2. **Admin** (90) - Administrative access
3. **Senior Pastor** (80) - Church-wide oversight
4. **Campus Pastor** (70) - Campus-level management
5. **District Pastor** (50) - District management
6. **Unit Head** (40) - Unit leadership
7. **Member** (10) - Basic member access

### Membership-Based Permissions

Members automatically get permissions based on `membershipStatus`:

- **MEMBER** → Basic member permissions
- **DC** (Discipleship Class) → DC permissions
- **LXL** (Leadership Exchange Lab) → LXL + unit leadership eligibility
- **DIRECTOR** → Ministry director permissions
- **PASTOR** → Pastoral permissions
- **CAMPUS_PASTOR** → Campus pastor permissions
- **SENIOR_PASTOR** → Senior pastor permissions

### Guards & Decorators

**Guards**:
- `JwtAuthGuard` - Validates JWT token
- `PermissionGuard` - Checks required permissions
- `ThrottlerGuard` - Rate limiting (100 req/min)

**Decorators**:
- `@Public()` - Bypass authentication
- `@RequirePermission('module:action')` - Single permission
- `@RequireAnyPermission([...])` - Any one permission
- `@RequireAllPermissions([...])` - All permissions required
- `@CurrentUser()` - Inject current user

**Example Controller**:

```typescript
@Controller('features')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FeaturesController {
  @Get()
  @RequirePermission('feature:view')
  findAll(@CurrentUser() user: any) {
    // user.sub = user ID
    // user.email = user email
  }

  @Post()
  @Public() // No auth required
  createPublic() { }
}
```

---

## Database Schemas

### Key Models

#### User
```typescript
{
  email: string (unique, required)
  password: string (bcrypt hashed)
  firstName: string
  lastName: string
  role: ObjectId → Role
  isActive: boolean
  needsPasswordChange: boolean
  invitation: ObjectId → UserInvitation
}
```

#### Member
```typescript
{
  firstName, lastName, email, phone
  dateOfBirth, gender, maritalStatus
  membershipStatus: MEMBER | DC | LXL | DIRECTOR | PASTOR | ...
  branch: ObjectId → Branch
  district: ObjectId → Group
  unit: ObjectId → Group
  role: ObjectId → Role
  // 50+ fields total
}
```

#### Attendance ✨ NEW
```typescript
{
  member: ObjectId → User
  serviceDate: Date
  serviceType: SUNDAY_FIRST_SERVICE | MIDWEEK_SERVICE | ...
  status: PRESENT | ABSENT | LATE | EXCUSED
  ministry: ObjectId → Ministry
  unit: ObjectId → Unit
  recordedBy: ObjectId → User
  checkInTime, checkOutTime, notes
}
```

#### Ministry ✨ NEW
```typescript
{
  name: string (unique)
  description: string
  director: ObjectId → User
  isActive: boolean
}
```

#### Unit ✨ NEW
```typescript
{
  name: string
  leader: ObjectId → User (must be LXL)
  unitType: GIA | DISTRICT | MINISTRY_UNIT | LEADERSHIP_UNIT
  ministry: ObjectId → Ministry
  isActive: boolean
}
```

### Indexes

All collections have proper indexes for:
- Unique constraints (email, phone)
- Foreign keys (branch, district, unit)
- Common queries (name, date ranges)
- Full-text search (where applicable)

Verify indexes:
```javascript
db.members.getIndexes()
db.attendance.getIndexes()
```

---

## API Endpoints (Key Routes)

### Authentication
```http
POST   /api/v1/auth/register         # Register (invitation required)
POST   /api/v1/auth/login            # Login
POST   /api/v1/auth/forgot-password  # Request password reset
POST   /api/v1/auth/reset-password   # Reset with token
GET    /api/v1/auth/me               # Current user profile
PATCH  /api/v1/auth/change-password  # Change password
```

### Members
```http
GET    /api/v1/members               # List (with filters & pagination)
POST   /api/v1/members               # Create
GET    /api/v1/members/:id           # Details
PATCH  /api/v1/members/:id           # Update
DELETE /api/v1/members/:id           # Delete
GET    /api/v1/members/stats         # Statistics
POST   /api/v1/members/bulk-import   # CSV import
GET    /api/v1/members/export        # Export to CSV
```

### Attendance ✨ NEW
```http
GET    /api/v1/attendance                      # List all
POST   /api/v1/attendance                      # Create single
POST   /api/v1/attendance/quick                # Mark multiple as present
POST   /api/v1/attendance/bulk                 # Bulk create
GET    /api/v1/attendance/stats                # Statistics
GET    /api/v1/attendance/trends               # Trends over time
GET    /api/v1/attendance/member/:memberId     # Member history
PATCH  /api/v1/attendance/:id                  # Update
DELETE /api/v1/attendance/:id                  # Delete
```

### Ministries ✨ NEW
```http
GET    /api/v1/ministries                              # List all
POST   /api/v1/ministries                              # Create
GET    /api/v1/ministries/active                       # Active only
GET    /api/v1/ministries/stats                        # Statistics
GET    /api/v1/ministries/:id                          # Details
PATCH  /api/v1/ministries/:id                          # Update
PATCH  /api/v1/ministries/:id/director/:directorId     # Assign director
PATCH  /api/v1/ministries/:id/toggle-status            # Toggle active/inactive
DELETE /api/v1/ministries/:id                          # Delete
```

### Units ✨ NEW
```http
GET    /api/v1/units                         # List all
POST   /api/v1/units                         # Create
GET    /api/v1/units/active                  # Active only
GET    /api/v1/units/stats                   # Statistics
GET    /api/v1/units/ministry/:ministryId    # By ministry
GET    /api/v1/units/:id                     # Details
PATCH  /api/v1/units/:id                     # Update
PATCH  /api/v1/units/:id/leader/:leaderId    # Assign leader (validates not leading another unit)
PATCH  /api/v1/units/:id/toggle-status       # Toggle status
DELETE /api/v1/units/:id                     # Delete
```

### Swagger Documentation

Access interactive API docs at `/api/docs` (development only).

---

## Queue System (Bull + Redis)

### Queue Types

Defined in `src/common/interfaces/queue-job.interface.ts`:

```typescript
enum QueueName {
  AUDIT_LOGS = 'audit_logs',
  EMAIL_NOTIFICATIONS = 'email_notifications',
  FIRST_TIMER_NOTIFICATIONS = 'first_timer_notifications',
  ACTIVITY_LOGS = 'activity_logs',
  ENTRY_IMPORT = 'entry_import',
  BULK_OPERATIONS = 'bulk_operations',
  BULK_EMAIL = 'bulk_email',
}
```

### Queue Processors

Located in `src/queue/processors/`:
- `audit-log.processor.ts` - Async audit log creation
- `email-notification.processor.ts` - Email sending
- `first-timer-notification.processor.ts` - Follow-up reminders
- `first-timer-automation.processor.ts` - Auto-assignment
- `activity-log.processor.ts` - Activity tracking
- `bulk-operation.processor.ts` - Batch operations
- `bulk-email.processor.ts` - Campaign emails

### Adding Jobs to Queue

```typescript
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from '@/common/interfaces/queue-job.interface';

@Injectable()
export class MyService {
  constructor(
    @InjectQueue(QueueName.EMAIL_NOTIFICATIONS) private emailQueue: Queue,
  ) {}

  async sendEmail(data: any) {
    await this.emailQueue.add('send-email', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
```

### Queue Monitoring

**Bull Board Dashboard**: `/admin/queues`

⚠️ **WARNING**: Currently not secured! Add auth middleware:

```typescript
// In main.ts
const authMiddleware = (req, res, next) => {
  // Implement authentication
  if (!isAuthenticated(req)) {
    return res.status(401).send('Unauthorized');
  }
  next();
};

app.use('/admin/queues', authMiddleware, bullBoardService.getRouter());
```

---

## Email System

### Multi-Provider Support

Configured via `EMAIL_PROVIDER` environment variable. Falls back to next provider on failure.

Providers (in order):
1. **SendGrid** (primary)
2. **Resend**
3. **ZeptoMail**
4. **Nodemailer/SMTP** (fallback)

### Sending Emails

```typescript
import { NotificationsService } from '@/notifications/notifications.service';

@Injectable()
export class MyService {
  constructor(private notifications: NotificationsService) {}

  async sendWelcome(email: string, name: string) {
    await this.notifications.sendEmail({
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      context: { name },
    });
  }
}
```

### Bulk Email Campaigns

```http
POST /api/v1/bulk-email/campaigns
{
  "name": "Monthly Newsletter",
  "templateId": "...",
  "recipients": ["filter", "criteria"],
  "scheduledFor": "2026-03-01T10:00:00Z"
}
```

---

## File Uploads (Cloudinary)

### Configuration

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Upload Endpoint

```http
POST /api/v1/upload
Content-Type: multipart/form-data

file: <binary>
folder: string (optional)
```

Response:
```json
{
  "url": "https://res.cloudinary.com/...",
  "publicId": "...",
  "format": "jpg"
}
```

---

## Audit Logging

### Automatic Audit Trail

**AuditLogInterceptor** automatically logs all CRUD operations:
- User who performed action
- Action type (CREATE, UPDATE, DELETE)
- Resource type & ID
- Changes (before/after)
- Timestamp, IP, User Agent

### Accessing Audit Logs

```http
GET /api/v1/audit-logs?resourceType=Member&page=1&limit=20
```

### Custom Audit Logs

```typescript
import { AuditService } from '@/audit-logs/audit.service';
import { AuditAction, ResourceType } from '@/common/interfaces/audit-log.interface';

@Injectable()
export class MyService {
  constructor(private auditService: AuditService) {}

  async customAction(userId: string) {
    await this.auditService.log({
      userId,
      action: AuditAction.CUSTOM,
      resource: ResourceType.MEMBER,
      resourceId: 'member-id',
      changes: { field: 'newValue' },
      severity: 'high',
    });
  }
}
```

---

## Multi-Branch Support

### Branch Scoping

`BranchAccessService` handles data scoping:

```typescript
import { BranchAccessService } from '@/common/services/branch-access.service';

@Injectable()
export class MyService {
  constructor(private branchAccess: BranchAccessService) {}

  async findAll(user: any) {
    const filter = await this.branchAccess.getScopeFilter(user);
    return this.model.find(filter);
  }
}
```

### Access Levels

- **GLOBAL**: Super admin sees all branches
- **BRANCH**: Campus pastor sees their branch
- **DISTRICT**: District pastor sees their district
- **UNIT**: Unit head sees their unit
- **SELF**: Member sees only their data

---

## CSV Import System

### Import Handlers

Located in `src/entry-import/handlers/`:
- `members.handler.ts`
- `first-timers.handler.ts`
- `groups.handler.ts`
- `branches.handler.ts`
- `service-reports.handler.ts`

### Import Endpoint

```http
POST /api/v1/entry-import
Content-Type: multipart/form-data

file: <csv-file>
type: "members" | "first-timers" | "groups" | ...
options: { skipExisting: true, validateOnly: false }
```

Processed asynchronously via queue. Check status:

```http
GET /api/v1/entry-import/:jobId/status
```

---

## Security Considerations

### ✅ Implemented Security Features

1. JWT authentication with bcrypt password hashing (10 rounds)
2. Rate limiting (100 requests/minute via ThrottlerGuard)
3. Input validation (class-validator on all DTOs)
4. Helmet.js security headers
5. CORS with origin whitelisting
6. MongoDB SSL/TLS enabled
7. Permission-based access control (RBAC)
8. Comprehensive audit logging
9. Invitation-based registration (no public signup)
10. Password reset with secure tokens

### ⚠️ Security Issues to Fix

1. **Default Passwords** - Lines 178 in `auth.service.ts` and 1874 in `members.service.ts`
   ```typescript
   // ⚠️ ISSUE
   const defaultPassword = 'ppt12345'; // Too simple!
   const defaultPassword = 'Welcome123!'; // Also too simple!

   // ✅ FIX: Use crypto.randomBytes + force password change
   const defaultPassword = crypto.randomBytes(16).toString('hex');
   ```

2. **Bull Board Not Secured** - `main.ts` line 78
   ```typescript
   // ⚠️ ISSUE
   app.use('/admin/queues', bullBoardService.getRouter());

   // ✅ FIX: Add authentication middleware
   app.use('/admin/queues', authMiddleware, bullBoardService.getRouter());
   ```

3. **Swagger in Production** - `main.ts` line 74
   ```typescript
   // ⚠️ ISSUE: Always enabled

   // ✅ FIX: Conditional setup
   if (process.env.NODE_ENV !== 'production') {
     SwaggerModule.setup('api/docs', app, document);
   }
   ```

4. **Console Logging** - 96 occurrences across 19 files
   ```typescript
   // ⚠️ ISSUE
   console.log('Debug info:', data);
   console.error('Error:', error);

   // ✅ FIX: Use Logger service
   private readonly logger = new Logger(MyService.name);
   this.logger.log('Info');
   this.logger.error('Error', error.stack);
   ```

---

## Data Validation TODOs

### Known Missing Validations

**In `members.service.ts`** (Lines 74-75, 954, 974):
```typescript
// TODO: Validate district exists and is of type 'district'
// TODO: Validate unit exists and is of type 'unit'
```

**In `groups.service.ts`** (Lines 79-80, 83-84):
```typescript
// TODO: Validate districtPastor not leading another district
// TODO: Validate unitHead not leading another unit
```

**Fix Example**:
```typescript
// Before creating/updating member
if (dto.districtId) {
  const district = await this.groupsModel.findOne({
    _id: dto.districtId,
    type: GroupType.DISTRICT
  });
  if (!district) {
    throw new BadRequestException('Invalid district ID');
  }
}
```

---

## Testing

### Current State

⚠️ **LOW COVERAGE** - Only 10 test files:
- `app.controller.spec.ts`
- `auth.{controller,service}.spec.ts`
- `members.{controller,service}.spec.ts`
- `groups.{controller,service}.spec.ts`
- `first-timers.{controller,service}.spec.ts`
- `notifications.service.spec.ts`

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- --testPathPattern=members

# E2E tests
npm run test:e2e
```

### Writing Tests

```typescript
describe('MembersService', () => {
  let service: MembersService;
  let model: Model<MemberDocument>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: getModelToken(Member.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    model = module.get<Model<MemberDocument>>(getModelToken(Member.name));
  });

  it('should create a member', async () => {
    const dto = { firstName: 'John', lastName: 'Doe', /* ... */ };
    const result = await service.create(dto);
    expect(result).toBeDefined();
  });
});
```

---

## Adding a New Module

### Step-by-Step

1. **Generate module skeleton**:
```bash
nest g module feature-name
nest g controller feature-name
nest g service feature-name
```

2. **Create schema** (`src/feature-name/schemas/feature.schema.ts`):
```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Feature {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;
}

export type FeatureDocument = Feature & Document;
export const FeatureSchema = SchemaFactory.createForClass(Feature);

FeatureSchema.index({ name: 1 });
```

3. **Create DTOs** (`src/feature-name/dto/`):
```typescript
// create-feature.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

// update-feature.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateFeatureDto } from './create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
```

4. **Define permissions** (`src/feature-name/permissions/index.ts`):
```typescript
export enum FeaturePermission {
  VIEW = 'feature:view',
  CREATE = 'feature:create',
  EDIT = 'feature:edit',
  DELETE = 'feature:delete',
}
```

5. **Update module** (`src/feature-name/feature-name.module.ts`):
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeatureController } from './feature-name.controller';
import { FeatureService } from './feature-name.service';
import { Feature, FeatureSchema } from './schemas/feature.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feature.name, schema: FeatureSchema },
    ]),
  ],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureNameModule {}
```

6. **Import in app.module.ts**:
```typescript
import { FeatureNameModule } from './feature-name/feature-name.module';

@Module({
  imports: [
    // ... other modules
    FeatureNameModule,
  ],
})
export class AppModule {}
```

7. **Add permissions to global constant** (`src/common/constants/permissions.constant.ts`)

---

## Performance Optimization

### Database Query Optimization

1. **Use indexes** (already configured in schemas)
2. **Limit fields** with `.select()`:
```typescript
this.model.find().select('_id name email').exec();
```
3. **Populate judiciously**:
```typescript
// Bad: Populate everything
.populate('branch district unit role')

// Good: Limit populated fields
.populate('branch', 'name')
.populate('district', 'name type')
```
4. **Use pagination** on all list endpoints
5. **Use aggregation** for complex queries:
```typescript
this.model.aggregate([
  { $match: filter },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);
```

### Caching Strategy

Consider implementing Redis caching for:
- User permissions (already cached in auth context)
- Frequently accessed reference data (branches, roles)
- Member counts and statistics
- Dropdown options (active groups, ministries, units)

```typescript
// Example Redis caching
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MyService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getData(id: string) {
    const cacheKey = `data:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const data = await this.model.findById(id);
    await this.cacheManager.set(cacheKey, data, 3600); // TTL 1 hour
    return data;
  }
}
```

---

## Deployment Checklist

### Pre-Production

- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [ ] Configure production MongoDB with authentication
- [ ] Set up Redis with password
- [ ] Configure production email provider (SendGrid recommended)
- [ ] Set `NODE_ENV=production`
- [ ] **Disable Swagger** in production (add `if` check in main.ts)
- [ ] **Secure Bull Board** (add auth middleware)
- [ ] Configure CORS for production domains only
- [ ] Replace all `console.log` with `Logger` service
- [ ] Add production-specific error handling
- [ ] Configure file upload size limits
- [ ] Set up SSL/TLS certificates
- [ ] Configure database backups (MongoDB Atlas recommended)
- [ ] Set up monitoring (PM2, New Relic, Datadog, etc.)
- [ ] Configure log aggregation (ELK, CloudWatch, etc.)
- [ ] Test all critical user flows
- [ ] Run security audit: `npm audit`
- [ ] Test rate limiting under load
- [ ] Verify all environment variables are set

### Production Deployment

```bash
# Build
npm run build

# Start with PM2 (recommended)
pm2 start dist/main.js --name church-api -i max

# Or use Docker
docker build -t church-api .
docker run -d -p 3000:3000 --env-file .env church-api
```

---

## Troubleshooting

### MongoDB Connection Failed

```bash
# Check MongoDB is running
mongosh mongodb://localhost:27017

# Verify connection string
echo $MONGODB_URI

# Check network/firewall (for Atlas)
ping <cluster-address>
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Verify Redis config
echo $REDIS_HOST
echo $REDIS_PORT
```

### Emails Not Sending

1. Check email provider API keys in `.env`
2. View queue status at `/admin/queues`
3. Check email processor logs:
```bash
# In development
npm run start:dev | grep "EmailNotificationProcessor"
```
4. Test email provider directly:
```typescript
await this.emailService.sendTestEmail('test@example.com');
```

### Permission Denied Errors

1. Check user has required permission:
```http
GET /api/v1/auth/me
# Returns user.permissions array
```
2. Verify permission is assigned to role
3. Check permission guard is applied to endpoint
4. Review permission definitions in module

---

## Code Style & Conventions

### Linting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
npm run format        # Prettier formatting
```

### Style Guide

- **Quotes**: Single quotes
- **Semicolons**: Always
- **Trailing commas**: Yes
- **Indentation**: 2 spaces
- **Line length**: 100 characters (soft limit)

### TypeScript Config

- `strictNullChecks`: enabled
- `noImplicitAny`: disabled (allow implicit any for flexibility)
- `@typescript-eslint/no-explicit-any`: off

### Path Aliases

Both `@/*` and `src/*` map to `src/`:
```typescript
import { Member } from '@/members/schemas/member.schema';
import { Member } from 'src/members/schemas/member.schema'; // Also works
```

---

## Recent Updates

### 2026-02-24

✨ **New Modules Added**:

1. **Attendance Module** (`src/attendance/`)
   - Full CRUD for attendance records
   - Quick attendance marking (mark multiple members as present at once)
   - Bulk attendance creation
   - Attendance statistics & trends
   - Member attendance history
   - Service types: Sunday services, midweek, youth, ministry meetings, etc.
   - Attendance statuses: Present, Absent, Late, Excused

2. **Ministries Module** (`src/ministries/`)
   - Full CRUD for ministries
   - Director assignment with validation
   - Active/inactive status management
   - Ministry statistics
   - Active ministries endpoint for dropdowns

3. **Units Module** (`src/units/`)
   - Full CRUD for units
   - Leader assignment with validation (prevents duplicate leadership)
   - Unit types: GIA, DISTRICT, MINISTRY_UNIT, LEADERSHIP_UNIT
   - Ministry association (every unit belongs to a ministry)
   - Units by ministry filtering
   - Statistics by type and ministry

All three modules are **production-ready** with:
- Comprehensive validation
- Proper error handling
- Swagger documentation
- Permission-based access control
- MongoDB indexes for performance

---

## Known Issues & TODOs

### High Priority

1. ⚠️ **Default passwords hardcoded** - `auth.service.ts:178`, `members.service.ts:1874`
2. ⚠️ **Bull Board not secured** - `/admin/queues` accessible without auth
3. ⚠️ **Swagger exposed in production** - Should be disabled
4. ⚠️ **96 console.log statements** - Replace with Logger service

### Medium Priority

1. **Missing validations**:
   - District/unit references in members (lines 74-75, 954, 974 in `members.service.ts`)
   - Leadership assignments in groups (lines 79-80, 83-84 in `groups.service.ts`)
2. **Low test coverage** - Only 10 test files for 86 implementation files
3. **Missing notification system** - TODO in `worker-trainee.service.ts:105`

### Low Priority

1. Code documentation (JSDoc comments)
2. API response standardization (global exception filter)
3. Performance monitoring implementation
4. Advanced caching strategy

---

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Passport JWT Strategy](http://www.passportjs.org/packages/passport-jwt/)
- [Swagger/OpenAPI Spec](https://swagger.io/specification/)

---

**Last Updated**: February 24, 2026
**Version**: 1.0.0
**Maintainer**: Development Team

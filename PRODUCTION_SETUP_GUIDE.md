# Production Setup Guide - Church Management System

**Version:** 1.0
**Date:** February 24, 2026
**Audience:** System Administrators, DevOps Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Initial Setup Process](#initial-setup-process)
4. [User Roles Architecture](#user-roles-architecture)
5. [Setting Up Initial Users](#setting-up-initial-users)
6. [Operational Email Accounts](#operational-email-accounts)
7. [Post-Setup Verification](#post-setup-verification)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for setting up the Church Management System in a production environment, including:

- **Super Admin Account** (gthankgod@gmail.com)
- **System Roles** (Super Admin, Admin only)
- **Operational Email Accounts** (non-member emails for notifications and approvals)
- **Proper Role-Based Access Control (RBAC)**

### Current vs. Desired Architecture

**Current State:**
- System roles: `super_admin`, `admin`, `senior_pastor`, `campus_pastor`, `finance_manager`
- All users must be members in the database
- No support for operational/service email accounts

**Desired State:**
- System roles: `super_admin` and `admin` only
- Senior Pastor, Campus Pastor, Finance Manager, Pastor, Director, LXL = **Custom Roles** (not system roles)
- Support for operational email accounts (e.g., finance@church.com) for notifications and approvals

---

## System Requirements

### Infrastructure
- **Node.js**: 18.x or higher
- **MongoDB**: 5.x or higher
- **Redis**: 6.x or higher (for Bull queues)
- **RAM**: Minimum 2GB
- **Storage**: Minimum 10GB

### Required Services
- Email provider (ZeptoMail, SendGrid, or Resend)
- Cloudinary account (for file uploads)
- SSL certificate (for HTTPS in production)

---

## Initial Setup Process

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd church-management-system-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Step 2: Configure Environment Variables

Edit the `.env` file with production values:

```bash
# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# Database Configuration
# ============================================
DATABASE_URI=mongodb+srv://username:password@cluster.mongodb.net/church-production

# ============================================
# JWT Authentication
# ============================================
# CRITICAL: Generate a strong secret!
JWT_SECRET=<use: openssl rand -base64 32>
JWT_EXPIRES_IN=7d

# ============================================
# Redis Configuration
# ============================================
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS_ENABLED=true

# ============================================
# Email Configuration
# ============================================
EMAIL_PROVIDER=zeptomail-smtp
SENDER_EMAIL=noreply@yourchurch.org
ZEPTOMAIL_API_KEY=your-zeptomail-api-key
ZEPTOMAIL_SMTP_USERNAME=emailapikey
ZEPTOMAIL_SMTP_HOST=smtp.zeptomail.com
ZEPTOMAIL_SMTP_PORT=587

# ============================================
# CORS Configuration
# ============================================
ALLOWED_ORIGINS=https://yourchurch.org,https://admin.yourchurch.org

# ============================================
# Application Configuration
# ============================================
APP_NAME=Church Management System
APP_URL=https://api.yourchurch.org
FRONTEND_URL=https://admin.yourchurch.org

# ============================================
# Auto-Initialize Super Admin
# ============================================
AUTO_INIT_SUPER_ADMIN=true
SUPER_ADMIN_EMAIL=gthankgod@gmail.com
SUPER_ADMIN_PASSWORD=<generate-strong-password>
SUPER_ADMIN_FIRST_NAME=Thankgod
SUPER_ADMIN_LAST_NAME=George

# ============================================
# Security Configuration
# ============================================
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=<generate-strong-password>

# ============================================
# Cloudinary (File Uploads)
# ============================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Step 3: Build and Start the Application

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

**Expected Output:**
```
🔧 AutoInitService.onModuleInit() called
AUTO_INIT_SUPER_ADMIN = true
🚀 initializeIfNeeded() started
🔑 Seeding permissions...
✓ Permissions seeded successfully
🔍 Running endpoint discovery...
✓ Super Admin role synced with all permissions
🔐 Checking super admin setup...
📧 SUPER_ADMIN_EMAIL = gthankgod@gmail.com
🔑 SUPER_ADMIN_PASSWORD = [SET]
✓ Created super admin member: gthankgod@gmail.com
✓ Super admin role assigned to gthankgod@gmail.com
✓ Created accepted invitation for gthankgod@gmail.com
✓ System initialization/sync completed successfully
🚀 Church Management System API is running on port 3000
```

---

## User Roles Architecture

### System Roles (Built-in, Cannot be Modified)

#### 1. Super Admin
- **Email:** gthankgod@gmail.com
- **Permissions:** ALL (*)
- **Scope:** Global (all branches)
- **Purpose:** System owner, full control
- **Cannot be deleted or modified**

#### 2. Admin
- **Permissions:** Read access to ALL permissions (view:*)
- **Scope:** Global (all branches)
- **Purpose:** View-only administrator role
- **Cannot be deleted but permissions can be updated**

### Custom Roles (Created by Admin)

These are NOT system roles and should be created manually:

#### Senior Pastor
- **Permissions:** All view permissions + requisition approval
- **Scope:** Global (all branches)
- **Creation:** Manual (see below)

#### Campus Pastor
- **Permissions:** All view permissions + requisition approval
- **Scope:** Branch-specific
- **Creation:** Manual (see below)

#### Finance Manager
- **Permissions:** Finance view + approve/reject requisitions
- **Scope:** Global or Branch-specific
- **Creation:** Manual (see below)

#### Pastor
- **Permissions:** Custom (defined by organization)
- **Creation:** Manual

#### Director
- **Permissions:** Custom (defined by organization)
- **Creation:** Manual

#### LXL (League of Extraordinary Leaders)
- **Permissions:** Custom (defined by organization)
- **Creation:** Manual

---

## Setting Up Initial Users

### Step 1: Access the System

The super admin account is **automatically created** on first startup if `AUTO_INIT_SUPER_ADMIN=true`.

**Login Credentials:**
- **Email:** gthankgod@gmail.com
- **Password:** (from .env `SUPER_ADMIN_PASSWORD`)

**Login Endpoint:**
```bash
POST /api/v1/auth/login
{
  "email": "gthankgod@gmail.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "member": {
      "_id": "...",
      "email": "gthankgod@gmail.com",
      "firstName": "Thankgod",
      "lastName": "George",
      "role": {
        "_id": "...",
        "name": "Super Admin",
        "slug": "super-admin"
      }
    }
  }
}
```

### Step 2: Modify Admin Role for Read-Only Access

By default, the `admin` role has many write permissions. To convert it to read-only:

**Method 1: Via API (Recommended)**

```bash
# Get the admin role ID
GET /api/v1/roles?slug=admin
Authorization: Bearer <super-admin-token>

# Update admin role to have only view permissions
PUT /api/v1/roles/<admin-role-id>
Authorization: Bearer <super-admin-token>
{
  "name": "Admin",
  "displayName": "Administrator",
  "description": "Read-only administrator with view access to all system data",
  "permissions": ["view:*"],  // Special marker for all view permissions
  "isSystemRole": true,
  "level": 90
}
```

**Method 2: Via Database (Alternative)**

```javascript
// Connect to MongoDB
use church-production;

// Find admin role
db.roles.findOne({ slug: 'admin' });

// Get all view permission IDs
const viewPermissions = db.permissions.find({
  name: { $regex: /:view|:export|:preview/ }
}).toArray().map(p => p._id);

// Update admin role
db.roles.updateOne(
  { slug: 'admin' },
  {
    $set: {
      permissions: viewPermissions,
      description: 'Read-only administrator with view access to all system data'
    }
  }
);
```

### Step 3: Remove Non-System Roles

Remove `senior_pastor`, `campus_pastor`, and `finance_manager` from system roles:

**Update `/src/roles/constants/default-roles.constant.ts`:**

```typescript
export const DEFAULT_ROLES: DefaultRoleConfig[] = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    displayName: 'Super Administrator',
    description: 'Full system access with all permissions. Can manage all aspects of the system.',
    level: 100,
    isSystemRole: true,
    colorCode: '#EF4444',
    permissions: ['*'],
  },
  {
    name: 'Admin',
    slug: 'admin',
    displayName: 'Administrator',
    description: 'Read-only administrator with view access to all system data.',
    level: 90,
    isSystemRole: true,
    colorCode: '#F59E0B',
    permissions: ['view:*'], // All view permissions
  },
  // REMOVED: Senior Pastor, Campus Pastor, Finance Manager
  // These should be created as custom roles instead
];
```

**Rebuild and restart:**

```bash
npm run build
npm run start:prod
```

### Step 4: Create Custom Roles

Now create the removed roles as **custom roles** via the API:

#### Create Senior Pastor Role

```bash
POST /api/v1/roles
Authorization: Bearer <super-admin-token>
{
  "name": "Senior Pastor",
  "slug": "senior-pastor",
  "displayName": "Senior Pastor",
  "description": "Senior Pastor with view access to all data across all branches. Can approve requisitions.",
  "level": 80,
  "isSystemRole": false,
  "colorCode": "#8B5CF6",
  "permissions": ["view:*", "finance:approve-requisition", "finance:reject-requisition"]
}
```

#### Create Campus Pastor Role

```bash
POST /api/v1/roles
Authorization: Bearer <super-admin-token>
{
  "name": "Campus Pastor",
  "slug": "campus-pastor",
  "displayName": "Campus Pastor",
  "description": "Campus Pastor with view access to data within their assigned branch. Can approve requisitions.",
  "level": 70,
  "isSystemRole": false,
  "colorCode": "#06B6D4",
  "permissions": ["view:*", "finance:approve-requisition", "finance:reject-requisition"]
}
```

#### Create Finance Manager Role

```bash
POST /api/v1/roles
Authorization: Bearer <super-admin-token>
{
  "name": "Finance Manager",
  "slug": "finance-manager",
  "displayName": "Finance Manager",
  "description": "Finance Manager with finance view permissions and approval rights.",
  "level": 60,
  "isSystemRole": false,
  "colorCode": "#10B981",
  "permissions": [
    "finance:view-requisitions",
    "finance:view-requisition-details",
    "finance:view-my-requisitions",
    "finance:view-pending-approvals",
    "finance:view-pending-disbursements",
    "finance:view-expense-categories",
    "finance:view-form-fields",
    "finance:view-reports",
    "finance:view-dashboard",
    "finance:approve-requisition",
    "finance:reject-requisition",
    "finance:receive-disburse-confirmation"
  ]
}
```

### Step 5: Create Additional Admin Users

To create additional users with admin access:

```bash
# 1. Create a member first
POST /api/v1/members
Authorization: Bearer <super-admin-token>
{
  "email": "admin2@church.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+2348012345678",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "branch": "<branch-id>",
  "address": {
    "state": "Lagos"
  }
}

# 2. Invite the member (creates user invitation and sends email)
POST /api/v1/user-invitations
Authorization: Bearer <super-admin-token>
{
  "email": "admin2@church.com",
  "role": "<admin-role-id>",
  "branch": "<branch-id>"
}
```

The user will receive an email with:
- Temporary password
- Login link
- Instructions to change password on first login

---

## Operational Email Accounts

### Overview

Operational emails are **non-member** email addresses used for:
- **Notifications** (e.g., finance@church.com receives disbursement notifications)
- **Approvals** (e.g., pastor@church.com receives approval requests)
- **System Communications** (e.g., noreply@church.com for automated emails)

### Current Limitation

⚠️ **The current system requires all users to be members in the database.** Operational emails are NOT supported out-of-box.

### Solution: Implement Operational Accounts

You need to modify the system to support operational accounts. Here's how:

#### Option 1: Create "Service Member" Accounts

Create member accounts for operational emails with a special flag:

**Database Schema Update:**

```typescript
// Add to src/members/schemas/member.schema.ts
@Prop({ default: false })
isServiceAccount: boolean; // True for operational emails

@Prop({ type: String })
serviceAccountType?: string; // 'finance', 'notifications', 'approvals'
```

**Create Service Accounts:**

```bash
POST /api/v1/members
Authorization: Bearer <super-admin-token>
{
  "email": "finance@church.com",
  "firstName": "Finance",
  "lastName": "Department",
  "phone": "0000000000",
  "dateOfBirth": "2000-01-01",
  "gender": "male",
  "branch": "<main-branch-id>",
  "isServiceAccount": true,
  "serviceAccountType": "finance",
  "address": {
    "state": "Lagos"
  }
}
```

**Assign appropriate role:**

```bash
POST /api/v1/user-invitations
Authorization: Bearer <super-admin-token>
{
  "email": "finance@church.com",
  "role": "<finance-manager-role-id>",
  "branch": "<main-branch-id>"
}
```

#### Option 2: Create a Notification Recipients Table (Recommended)

Create a separate table for operational emails:

**New Schema:**

```typescript
// src/notifications/schemas/notification-recipient.schema.ts
@Schema({ timestamps: true })
export class NotificationRecipient {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({
    type: String,
    enum: ['finance', 'approvals', 'notifications', 'system'],
    required: true,
  })
  type: string;

  @Prop({ type: [String], default: [] })
  notificationTypes: string[]; // ['disbursement', 'approval_request', etc.]

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branch?: Types.ObjectId; // Optional: scope to specific branch
}
```

**Create Operational Recipients:**

```bash
POST /api/v1/notification-recipients
Authorization: Bearer <super-admin-token>
{
  "email": "finance@church.com",
  "displayName": "Finance Department",
  "type": "finance",
  "notificationTypes": ["disbursement", "approval_request", "budget_alert"],
  "isActive": true
}
```

**Update Notification Service:**

```typescript
// In your notification service
async sendDisbursementNotification(requisition: Requisition) {
  // Get finance recipients
  const recipients = await this.notificationRecipientModel.find({
    type: 'finance',
    notificationTypes: 'disbursement',
    isActive: true,
  });

  for (const recipient of recipients) {
    await this.emailProvider.sendEmail({
      to: recipient.email,
      subject: 'Disbursement Notification',
      template: 'disbursement',
      context: { requisition },
    });
  }
}
```

### Recommended Operational Emails

| Email | Purpose | Notifications |
|-------|---------|---------------|
| `finance@church.com` | Finance operations | Disbursements, budget alerts, financial reports |
| `pastor@church.com` | Pastoral approvals | Approval requests, member issues |
| `admin@church.com` | System administration | System alerts, critical errors |
| `noreply@church.com` | Automated emails | Password resets, confirmations |

---

## Post-Setup Verification

### Checklist

- [ ] Super admin can log in with gthankgod@gmail.com
- [ ] Admin role has only view permissions
- [ ] Senior Pastor, Campus Pastor, Finance Manager are custom roles (not system roles)
- [ ] Operational email accounts are configured
- [ ] All users can log in and access their dashboards
- [ ] Permissions are correctly applied
- [ ] Email notifications are working
- [ ] Bull Board is secured with authentication
- [ ] Swagger is disabled in production
- [ ] SSL/HTTPS is configured
- [ ] Database backups are configured
- [ ] Redis is configured and accessible
- [ ] Cloudinary uploads are working

### Test Super Admin Access

```bash
# Login as super admin
POST /api/v1/auth/login
{
  "email": "gthankgod@gmail.com",
  "password": "your-password"
}

# Verify permissions
GET /api/v1/auth/me
Authorization: Bearer <token>

# Expected: Role should be "Super Admin" with all permissions
```

### Test Admin Access (Read-Only)

```bash
# Create an admin user
# Assign admin role
# Login and try to create a member (should succeed if you have the token)
# Login and verify you can view all data

GET /api/v1/members
Authorization: Bearer <admin-token>
# Expected: Success - can view members

POST /api/v1/members
Authorization: Bearer <admin-token>
{...}
# Expected: Success if admin has create permission
# Expected: 403 Forbidden if admin only has view permissions
```

---

## Troubleshooting

### Issue: Super Admin Not Created

**Symptom:** Super admin account doesn't exist after startup

**Solution:**
1. Check logs for errors:
   ```bash
   tail -f logs/application.log
   ```

2. Verify environment variables:
   ```bash
   echo $AUTO_INIT_SUPER_ADMIN  # Should be "true"
   echo $SUPER_ADMIN_EMAIL      # Should be set
   echo $SUPER_ADMIN_PASSWORD   # Should be set
   ```

3. Manually run initialization script:
   ```bash
   npm run init:super-admin
   ```

### Issue: Cannot Login - "Invitation Required"

**Symptom:** Error: "Access denied. You need an invitation to access this platform."

**Solution:**
Create an accepted invitation for the user:

```javascript
db.userinvitations.insertOne({
  member: ObjectId("<member-id>"),
  role: ObjectId("<role-id>"),
  branch: ObjectId("<branch-id>"),
  status: "accepted",
  invitedBy: ObjectId("<super-admin-id>"),
  temporaryPassword: "N/A",
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  acceptedAt: new Date(),
  emailSent: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### Issue: "Admin" Role Has Write Permissions

**Symptom:** Admin users can create/update/delete records

**Solution:**
Update the admin role to have only view permissions:

```bash
# Get all view permission IDs
GET /api/v1/permissions?action=view
Authorization: Bearer <super-admin-token>

# Update admin role with only view permission IDs
PUT /api/v1/roles/<admin-role-id>
Authorization: Bearer <super-admin-token>
{
  "permissions": [<view-permission-ids>]
}
```

### Issue: Operational Emails Not Receiving Notifications

**Symptom:** finance@church.com doesn't receive disbursement emails

**Solution:**
1. Verify email is configured in notification recipients table
2. Check email provider logs
3. Verify `SENDER_EMAIL` in `.env` is whitelisted
4. Test email sending:

```bash
POST /api/v1/notifications/test-email
Authorization: Bearer <super-admin-token>
{
  "to": "finance@church.com",
  "subject": "Test Email",
  "body": "This is a test"
}
```

### Issue: Role Permissions Not Taking Effect

**Symptom:** User has role but can't access resources

**Solution:**
1. Clear Redis cache:
   ```bash
   redis-cli FLUSHDB
   ```

2. Restart application:
   ```bash
   npm run start:prod
   ```

3. Re-login to get fresh token

---

## Security Best Practices

### 1. Strong Passwords
- Use passwords with at least 16 characters
- Include uppercase, lowercase, numbers, and symbols
- Never use common words or patterns
- Generate with: `openssl rand -base64 32`

### 2. Environment Variables
- Never commit `.env` to version control
- Use secret management tools (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly (every 90 days)

### 3. Access Control
- Use principle of least privilege
- Regularly audit user permissions
- Remove inactive users
- Monitor super admin actions

### 4. Monitoring
- Set up logging (Winston, Sentry)
- Monitor failed login attempts
- Track permission changes
- Set up alerts for suspicious activity

### 5. Backups
- Daily database backups
- Test restore procedures monthly
- Store backups off-site
- Encrypt backup files

---

## Support and Maintenance

### Regular Tasks

**Daily:**
- Monitor application logs
- Check error rates
- Verify email delivery

**Weekly:**
- Review user access logs
- Check database size
- Verify backups

**Monthly:**
- Update dependencies
- Review and rotate secrets
- Audit user permissions
- Performance optimization

### Getting Help

For issues or questions:
1. Check logs: `/var/log/church-cms/`
2. Review documentation: `CLAUDE.md`
3. Contact system administrator
4. Create GitHub issue (for bugs)

---

## Appendix

### A. Environment Variable Reference

See `.env.example` for complete reference.

### B. API Endpoints

See Swagger docs at `/api/docs` (development only)

### C. Database Schema

See CLAUDE.md for complete schema documentation.

### D. Permission List

See `/api/v1/permissions` endpoint or `src/roles/constants/permissions.constant.ts`

---

**Document Version:** 1.0
**Last Updated:** February 24, 2026
**Maintained By:** System Administrator

# System Initialization Guide

This guide explains how the church management system initializes permissions, roles, and the super admin account.

## Automatic Initialization

The system automatically initializes on first startup:

### What Happens Automatically

When you start the application for the first time:

1. ✅ **All permissions are created** - Every module's permissions are seeded into the database
2. ✅ **All roles are created** - System roles (super_admin, admin, pastor, etc.) are created
3. ✅ **Super admin gets all permissions** - The super_admin role is assigned ALL permissions
4. ✅ **Admin user gets super_admin role** - If `admin@church.com` exists, it's assigned the super_admin role

### Configuration

Auto-initialization is controlled by the `AUTO_INIT_SUPER_ADMIN` environment variable:

```env
# .env file
AUTO_INIT_SUPER_ADMIN=true  # Enable auto-init (default)
# or
AUTO_INIT_SUPER_ADMIN=false # Disable auto-init
```

## Manual Initialization

If you need to manually initialize or re-initialize the system:

### Option 1: Using NPM Script (Recommended)

```bash
npm run init:super-admin
```

This script will:
- Seed all permissions from all modules
- Create/update all system roles
- Assign all permissions to super_admin role
- Find and assign super_admin role to admin@church.com

### Option 2: Using API Endpoint

You can also use the seeder API endpoints:

```bash
# Seed everything (permissions + roles)
curl -X POST http://localhost:3000/roles/seeder/all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Or seed individually:

# Seed only permissions
curl -X POST http://localhost:3000/roles/seeder/permissions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Seed only roles
curl -X POST http://localhost:3000/roles/seeder/roles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check seeding statistics
curl -X GET http://localhost:3000/roles/seeder/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Prerequisites

Before running initialization, ensure:

1. **Database is running** - MongoDB must be accessible
2. **User exists** - Create a user with email `admin@church.com` if you want automatic role assignment

### Creating the Admin User

If the admin user doesn't exist yet:

1. **Register through the API**:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@church.com",
    "password": "YourSecurePassword123!",
    "firstName": "System",
    "lastName": "Administrator",
    "phoneNumber": "+1234567890"
  }'
```

2. **Then run initialization**:
```bash
npm run init:super-admin
```

## What Gets Created

### Permissions (All Modules)

- **Members Module**: create, view, update, delete, export, etc.
- **Ministries Module**: create, view, update, delete, assign-director, etc.
- **Units Module**: create, view, update, delete, assign-head, etc.
- **First Timers Module**: create, view, update, delete, assign, etc.
- **Attendance Module**: create, view, update, delete, stats, etc.
- **Groups Module**: create, view, update, delete, assign-leader, etc.
- **Inventory Module**: create items, categories, movements, approve, etc.
- **Service Reports Module**: create, view, update, approve, etc.
- **Dashboard Module**: view modules, overview, stats, analytics, etc.
- **Workers Training Module**: create cohorts, trainees, assignments, etc.
- **Activity Tracker Module**: log events, view timeline, follow-ups, etc.
- **Roles Module**: create roles/permissions, assign permissions, seed, etc.
- **Audit Logs Module**: view logs, export, etc.
- **Bulk Operations Module**: import, export, bulk actions, etc.
- **Queue Module**: view queues, manage jobs, etc.

**Total**: ~150+ permissions across all modules

### System Roles

1. **Super Admin** (Level 100)
   - Has ALL permissions (wildcard `*`)
   - Full system access
   - Can manage everything

2. **Admin** (Level 90)
   - Broad permissions across most modules
   - Cannot modify critical system settings

3. **Pastor** (Level 80)
   - Pastoral and leadership functions
   - View/manage members, first-timers, reports

4. **District Pastor** (Level 60)
   - District-level access
   - Manage district members and activities

5. **Ministry Director** (Level 50)
   - Ministry management
   - Manage ministry members and events

6. **Unit Head** (Level 40)
   - Unit management
   - Manage unit members

7. **DC (David's Company)** (Level 20)
   - Worker permissions
   - Basic access to activities

8. **Member** (Level 10)
   - Basic member access
   - View own profile, mark attendance

## Verification

After initialization, verify everything is set up correctly:

### Check Statistics

```bash
npm run init:super-admin
```

Look for output like:
```
=== Initialization Complete ===
Total Permissions: 150
Active Permissions: 150
Public Permissions: 7
Total Roles: 8
System Roles: 8
Custom Roles: 0

Admin User: admin@church.com
Admin Role: Super Admin
================================
```

### Test Login

1. Login as admin@church.com
2. Check that you can access all modules on the frontend
3. Verify dashboard shows all available modules

## Troubleshooting

### Issue: "User admin@church.com not found"

**Solution**: Create the user first, then run initialization:
```bash
# Create user via API
curl -X POST http://localhost:3000/auth/register -d '...'

# Then initialize
npm run init:super-admin
```

### Issue: "Cannot access modules on frontend"

**Possible causes**:
1. Permissions not seeded - Run `npm run init:super-admin`
2. User not assigned super_admin role - Check user's role in database
3. Frontend cache - Clear browser cache and reload
4. JWT token expired - Login again

**Solution**:
```bash
# Re-run initialization
npm run init:super-admin

# Then login again on frontend
```

### Issue: "Initialization fails with database error"

**Solution**: Ensure MongoDB is running and accessible:
```bash
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Check connection string in .env
# MONGODB_URI=mongodb://localhost:27017/church-management
```

## Re-initialization

The system is **idempotent** - you can run initialization multiple times safely:

```bash
npm run init:super-admin
```

This will:
- ✅ Update existing permissions
- ✅ Update existing roles with new permissions
- ✅ Skip if admin already has super_admin role
- ✅ Add any new permissions from code updates

## Environment Variables

```env
# Auto-initialize on startup (default: true)
AUTO_INIT_SUPER_ADMIN=true

# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/church-management

# JWT secret for authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

## Best Practices

1. **First Startup**:
   - Let auto-initialization run
   - Check logs for success messages

2. **After Code Updates**:
   - Run `npm run init:super-admin` to update permissions

3. **Production Deployment**:
   - Create admin user before deployment
   - Set `AUTO_INIT_SUPER_ADMIN=true`
   - Monitor logs on first startup

4. **Multiple Environments**:
   - Each environment runs initialization independently
   - Same admin email can exist in dev, staging, and production

## Security Notes

⚠️ **Important Security Considerations**:

1. **Change default admin password** immediately after first login
2. **Use strong passwords** for admin accounts
3. **Limit super_admin role** to only necessary personnel
4. **Enable 2FA** for admin accounts (if available)
5. **Audit admin actions** regularly via audit logs
6. **Rotate JWT secrets** periodically in production

## Support

If you encounter issues:

1. Check application logs for error messages
2. Verify MongoDB is running and accessible
3. Ensure all environment variables are set correctly
4. Review this guide for troubleshooting steps
5. Contact the development team if issues persist

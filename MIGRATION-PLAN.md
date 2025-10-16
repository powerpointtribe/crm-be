# User-Member Consolidation Migration Plan

## Overview
This migration consolidates the separate `User` and `Member` entities into a single `Member` entity with comprehensive authentication and church management capabilities.

## Current State Analysis

### User Schema (Authentication-focused)
- **Purpose**: Authentication and basic access control
- **Key Fields**: email, password, roles[], phone, lastLogin, isActive
- **Access Control**: Basic role-based (member, dc, lxl, director, pastor, admin)
- **Relationships**: ministry, unit, leaderOfUnit, directorOfMinistries

### Member Schema (Church Management-focused)
- **Purpose**: Comprehensive church member data
- **Key Fields**: Personal info, address, spiritual journey, family, leadership roles
- **Missing**: Authentication fields (password, lastLogin)
- **Rich Data**: baptismDate, emergencyContact, engagement tracking

## Migration Strategy

### Phase 1: Schema Consolidation
1. **Create Unified Member Schema** ✅
   - Merge all fields from both schemas
   - Add authentication fields to Member
   - Enhance with RBAC properties (unitType, systemRoles)
   - Add access control methods

2. **Create Enhanced Access Control Service** ✅
   - Module-based access control
   - Unit-type based permissions
   - Leadership role-based access
   - Resource-specific permissions

### Phase 2: Backend Migration

#### Step 1: Data Migration Script
```javascript
// Create migration script to:
// 1. Copy User data to Member schema
// 2. Merge existing Member records with User authentication data
// 3. Handle orphaned records (Users without Members, Members without Users)
// 4. Verify data integrity
```

#### Step 2: Service Layer Updates
- Update AuthService to use Member entity
- Update MembersService with authentication methods
- Create AccessControlService integration
- Update all guards and decorators

#### Step 3: Controller Updates
- Replace UsersController logic with enhanced MembersController
- Update all module controllers to use new access control
- Add granular permission checks

### Phase 3: Frontend Migration

#### Step 1: Authentication Updates
- Update auth service to work with Member entity
- Update user context/store to use member data
- Update JWT token handling

#### Step 2: Remove Users Module
- Remove Users pages/components
- Update navigation to remove Users link
- Redirect Users routes to Members

#### Step 3: Access Control Implementation
- Create hook for checking module access
- Update route guards
- Implement conditional UI rendering based on permissions

## Detailed Migration Steps

### Backend Migration Script

```typescript
// migration-script.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users/schemas/user.schema';
import { Member as OldMember } from './members/schemas/member.schema';
import { Member as NewMember } from './members/schemas/member-unified.schema';

@Injectable()
export class UserMemberMigrationService {
  async migrateData() {
    // 1. Get all users and members
    const users = await this.userModel.find();
    const members = await this.oldMemberModel.find();

    // 2. Create mapping by email
    const usersByEmail = new Map(users.map(u => [u.email, u]));
    const membersByEmail = new Map(members.map(m => [m.email, m]));

    // 3. Merge data and create new members
    for (const user of users) {
      const existingMember = membersByEmail.get(user.email);

      const newMemberData = {
        // From User
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        systemRoles: user.roles,

        // From Member (if exists)
        ...(existingMember && {
          dateOfBirth: existingMember.dateOfBirth,
          gender: existingMember.gender,
          maritalStatus: existingMember.maritalStatus,
          address: existingMember.address,
          membershipStatus: existingMember.membershipStatus,
          dateJoined: existingMember.dateJoined,
          district: existingMember.district,
          unit: existingMember.unit,
          leadershipRoles: existingMember.leadershipRoles,
          // ... all other member fields
        }),

        // Set defaults for missing fields
        dateOfBirth: existingMember?.dateOfBirth || new Date('1990-01-01'),
        gender: existingMember?.gender || 'male',
        membershipStatus: existingMember?.membershipStatus || 'new_convert',
        dateJoined: existingMember?.dateJoined || user.createdAt,
      };

      await this.newMemberModel.create(newMemberData);
    }

    // 4. Handle members without users (create with default password)
    for (const member of members) {
      if (!usersByEmail.has(member.email)) {
        const newMemberData = {
          ...member.toObject(),
          password: await bcrypt.hash('ChangeMe123!', 10), // Default password
          systemRoles: ['member'],
          isActive: true,
        };

        await this.newMemberModel.create(newMemberData);
      }
    }
  }
}
```

### Frontend Migration Plan

#### 1. Update Authentication Context
```typescript
// contexts/AuthContext.tsx
interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRoles: string[];
  unitType?: string;
  membershipStatus: string;
  accessibleModules: string[];
  leadershipRoles: {
    isDistrictPastor: boolean;
    isUnitHead: boolean;
    isChamp: boolean;
  };
}

const AuthContext = createContext<{
  member: Member | null;
  canAccessModule: (module: string) => boolean;
  hasRole: (role: string) => boolean;
  isLeader: boolean;
}>({});
```

#### 2. Remove Users Module
```typescript
// Remove these files:
// - src/pages/Users/
// - src/services/users.ts
// - Update navigation
// - Update routing
```

#### 3. Update Access Control
```typescript
// hooks/usePermissions.ts
export const usePermissions = () => {
  const { member } = useAuth();

  return {
    canAccessFirstTimers: member?.accessibleModules.includes('first_timers'),
    canAccessMembers: member?.accessibleModules.includes('members'),
    canManageUsers: member?.accessibleModules.includes('user_management'),
    isGIA: member?.unitType === 'gia',
    isPastor: member?.systemRoles.includes('pastor'),
    isAdmin: member?.systemRoles.includes('admin'),
  };
};
```

## Access Control Rules Summary

### Module Access Rules
1. **First Timers**: GIA unit members + District Pastors + Unit Heads
2. **Members**: All leadership + GIA unit members
3. **Groups**: Leadership + LXL members
4. **User Management**: Pastors + Admins + District Pastors
5. **Reports**: All roles (filtered by access level)

### Data Filtering Rules
1. **District Pastors**: See their district members
2. **Unit Heads**: See their unit members
3. **GIA Members**: See all for integration purposes
4. **Regular Members**: Limited access to own profile

## Testing Strategy

### Unit Tests
- Access control service methods
- Permission checking logic
- Data filtering functions

### Integration Tests
- Login with different member types
- Module access verification
- Resource access control

### End-to-End Tests
- Complete user journeys for each role type
- Cross-module navigation
- Permission boundary testing

## Rollback Plan

1. **Database Backup**: Full backup before migration
2. **Gradual Rollout**: Feature flags for new vs old system
3. **Parallel Systems**: Run both systems temporarily
4. **Data Verification**: Comprehensive data validation scripts

## Timeline

- **Week 1**: Complete backend migration and testing
- **Week 2**: Frontend updates and integration
- **Week 3**: End-to-end testing and bug fixes
- **Week 4**: Production deployment and monitoring

## Success Criteria

1. ✅ Single Member entity handles all authentication and church data
2. ✅ Granular access control based on roles, units, and leadership positions
3. ✅ No duplicate user management interfaces
4. ✅ Seamless user experience with appropriate module visibility
5. ✅ All existing functionality preserved
6. ✅ Improved security and maintainability
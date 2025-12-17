# Status Fields Guide

## Clear Distinction Between Status Types

This document clarifies the distinction between two different status types used in the Church Management System.

---

## 1. Member Status (Members Module)

### Purpose
Represents the **hierarchical status/position** of members within the church organization.

### Values
- **MEMBER** - Regular church member
- **DC** - Discipleship Class member
- **LXL** - Leadership Excellence Level
- **DIRECTOR** - Director level
- **PASTOR** - Pastor
- **SENIOR_PASTOR** - Senior Pastor

### Usage
- **Module**: Members Module
- **Schema**: `src/members/schemas/member.schema.ts`
- **Enum**: `src/common/enums/member-status.enum.ts`
- **Field Name**: `membershipStatus`
- **Default Value**: `MEMBER`

### Example
```typescript
{
  _id: "123",
  firstName: "John",
  lastName: "Doe",
  membershipStatus: "DC",  // This member is in Discipleship Class
  ...
}
```

---

## 2. Engagement Status (First Timers Module)

### Purpose
Tracks the **engagement journey** of first-time visitors as they are being followed up and integrated into the church.

### Values
- **NEW** - First timer just registered, no contact yet
- **ENGAGED** - First timer is being followed up/engaged with
- **CLOSED** - Engagement completed (converted to member or archived)

### Usage
- **Module**: First Timers Module
- **Schema**: `src/first-timers/schemas/first-timer.schema.ts`
- **Enum**: `src/common/enums/engagement-status.enum.ts`
- **Field Name**: `status`
- **Default Value**: `NEW`

### Example
```typescript
{
  _id: "456",
  firstName: "Jane",
  lastName: "Smith",
  status: "ENGAGED",  // This first-timer is being followed up
  ...
}
```

---

## Migration Guide

### Migrating Existing Member Data

If you have existing members with old status values, run the migration script:

```bash
cd /Users/thankgodgeorge/my-projects/church-management-system-backend
npm run migrate:member-statuses
```

### Status Mapping (Old → New)

| Old Status | New Status |
|-----------|-----------|
| NEW_CONVERT | MEMBER |
| WORKER | DC |
| VOLUNTEER | MEMBER |
| LEADER | LXL |
| DISTRICT_PASTOR | PASTOR |
| CHAMP | DC |
| UNIT_HEAD | DIRECTOR |
| INACTIVE | MEMBER |
| TRANSFERRED | MEMBER |

---

## Frontend Implementation

### Member Status Display

In the Members module, use the `membershipStatus` field:

```typescript
// Frontend: src/types/index.ts
interface Member {
  membershipStatus: 'MEMBER' | 'DC' | 'LXL' | 'DIRECTOR' | 'PASTOR' | 'SENIOR_PASTOR'
}

// Display example
<Badge>{member.membershipStatus}</Badge>
// Shows: MEMBER, DC, LXL, etc.
```

### Engagement Status Display

In the First Timers module, use the `status` field:

```typescript
// Frontend: src/services/first-timers.ts
interface FirstTimer {
  status: 'NEW' | 'ENGAGED' | 'CLOSED'
}

// Display example
<Badge>{firstTimer.status}</Badge>
// Shows: NEW, ENGAGED, or CLOSED
```

---

## Important Notes

1. **Do NOT mix these statuses** - Member status is for church members, engagement status is for first-time visitors
2. **Backend validation** - The schemas enforce these enum values, invalid values will be rejected
3. **Default values** - New members default to `MEMBER`, new first-timers default to `NEW`
4. **Legacy support** - Old status values are deprecated but kept in `LegacyMembershipStatus` enum for reference

---

## Quick Reference

| What | Module | Field Name | Values |
|------|--------|------------|--------|
| **Member Status** | Members | `membershipStatus` | MEMBER, DC, LXL, DIRECTOR, PASTOR, SENIOR_PASTOR |
| **Engagement Status** | First Timers | `status` | NEW, ENGAGED, CLOSED |

---

**Last Updated**: December 16, 2025

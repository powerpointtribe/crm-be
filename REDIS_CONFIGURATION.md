# Redis Configuration Fix

## Issue
`ERR max number of clients reached` - Redis has hit its maximum client connection limit.

## What Changed
Temporarily disabled unused Bull queues to reduce Redis connections from 15 to 9:
- ❌ BULK_OPERATION (disabled - no active processor)
- ✅ FIRST_TIMER_NOTIFICATIONS (active)
- ❌ FIRST_TIMER_AUTOMATION (disabled - processor commented out)
- ✅ AUDIT_LOGS (active)
- ✅ EMAIL_NOTIFICATIONS (active - needed for user invitations)

## Permanent Solution

### Option 1: Increase Redis maxclients (Recommended)

**Check current limit:**
```bash
redis-cli CONFIG GET maxclients
```

**Increase limit temporarily:**
```bash
redis-cli CONFIG SET maxclients 100
```

**Increase limit permanently:**

1. **For Redis installed via Homebrew (Mac):**
```bash
# Edit Redis config
nano /opt/homebrew/etc/redis.conf

# Find and update:
maxclients 100

# Restart Redis
brew services restart redis
```

2. **For Redis via Docker:**
```bash
# Run with increased maxclients
docker run -d --name redis -p 6379:6379 redis redis-server --maxclients 100
```

3. **For Linux:**
```bash
# Edit config
sudo nano /etc/redis/redis.conf

# Find and update:
maxclients 100

# Restart Redis
sudo systemctl restart redis
```

### Option 2: Check for Connection Leaks

**List all Redis clients:**
```bash
redis-cli CLIENT LIST
```

**Kill idle connections:**
```bash
redis-cli CLIENT KILL TYPE normal
```

**Check connection count:**
```bash
redis-cli INFO clients | grep connected_clients
```

## Connection Usage Per Queue

Each Bull queue creates **3 Redis connections**:
- 1 client (for job operations)
- 1 subscriber (for event listening)  
- 1 blocking client (for processing)

**Before (15 connections):**
- BULK_OPERATION: 3
- FIRST_TIMER_NOTIFICATIONS: 3
- FIRST_TIMER_AUTOMATION: 3
- AUDIT_LOGS: 3
- EMAIL_NOTIFICATIONS: 3

**After (9 connections):**
- FIRST_TIMER_NOTIFICATIONS: 3
- AUDIT_LOGS: 3
- EMAIL_NOTIFICATIONS: 3

## Re-enable Queues

When Redis is configured with higher maxclients, uncomment queues in:
- `src/queue/queue.module.ts` (lines 82-90)
- `src/queue/queue.service.ts` (lines 20-25)

## Environment Variables

Ensure your `.env` has:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

## Testing

After configuration, restart the app:
```bash
npm run start:dev
```

Check logs for successful connection:
```
Bull Redis client connected
Bull Redis subscriber connected
Bull Redis blocking client connected
```

---
**Date**: 2025-12-22
**Status**: ✅ Temporary fix applied
**Action**: Configure Redis maxclients for permanent solution

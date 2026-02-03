# Database Reference

## Contents
- Session Storage Architecture
- In-Memory Store (Current)
- Production Store Options
- WARNING: Store Selection

## Session Storage Architecture

This codebase uses the **default MemoryStore** for session storage. This is intentional for the NOC dashboard use case:

- Single-user or few-user access pattern
- Sessions are ephemeral (re-login acceptable after restart)
- No persistence requirements
- Minimal infrastructure dependencies

```javascript
// src/middleware/session.js - Implicit MemoryStore
const sessionParser = session({
  secret: process.env.SESSION_SECRET,
  resave: false,              // Don't save session if unmodified
  saveUninitialized: false,   // Don't create session until something stored
  cookie: { /* ... */ }
  // No 'store' option = MemoryStore
});
```

## In-Memory Store Characteristics

| Aspect | Behavior |
|--------|----------|
| Persistence | None - sessions lost on restart |
| Memory | Grows with active sessions |
| Scaling | Single process only |
| Expiration | Relies on cookie maxAge only |
| Best for | Development, single-user apps |

## Production Store Options

**WARNING:** This section documents options not currently implemented in this codebase.

### Redis Store (Recommended for Most Apps)

```javascript
// NOT in this codebase - for reference
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

const sessionParser = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
});
```

### PostgreSQL Store

```javascript
// NOT in this codebase - for reference
const pgSession = require('connect-pg-simple')(session);

const sessionParser = session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions'
  }),
  secret: process.env.SESSION_SECRET
});
```

## WARNING: Store Selection

### MemoryStore Memory Growth

**The Problem:**

```javascript
// Default behavior - no explicit store
const sessionParser = session({
  secret: 'key'
  // MemoryStore is used implicitly
});
```

**Why This Can Break (in different contexts):**
1. Sessions accumulate without cleanup
2. Server memory grows over weeks/months
3. No session sharing across Node.js cluster workers

**When MemoryStore Is Acceptable:**
- NOC dashboard with few users (this project)
- Development environments
- Short-lived sessions with frequent restarts
- Single process deployment

**When to Add External Store:**
- Multi-process or clustered deployment
- Need session persistence across restarts
- Many concurrent users (100+)
- Long session lifetimes

### Missing Store Configuration Checklist

Copy this checklist for production readiness:
- [ ] Evaluate session persistence requirements
- [ ] If multi-process: add Redis or database store
- [ ] Configure session cleanup/expiration
- [ ] Test session behavior across server restart
- [ ] Monitor memory usage in production

## Current Codebase Decision

This project intentionally uses MemoryStore because:
1. NOC display - limited authorized viewers
2. In-memory architecture throughout (no database)
3. 24-hour session maxAge limits accumulation
4. Restart tolerance acceptable for this use case
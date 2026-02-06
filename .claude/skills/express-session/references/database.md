# Database Reference

## Contents
- Storage Architecture
- Password File Persistence
- In-Memory Session Store
- In-Memory Settings Store
- Dead Letter Queue
- Anti-Patterns

## Storage Architecture

This project has **no database**. All state is in-memory or file-based:

| Data | Storage | Location | Survives Restart? |
|------|---------|----------|-------------------|
| Sessions | In-memory (express-session default) | RAM | No |
| Password hash | File | `data/password.hash` | Yes |
| Settings | In-memory object | `src/routes/settings.js` | No |
| Failed messages | JSONL file | `logs/failed-messages.jsonl` | Yes |
| Geo cache | In-memory (LRU) | `src/enrichment/cache.js` | No |

This is intentional — the app is a real-time visualization tool, not a data store. See the **lru-cache** skill for the geolocation cache.

## Password File Persistence

The only durable write in the auth system. File is created after first password change.

### Writing Password Hash

```javascript
// src/routes/change-password.js
const PASSWORD_FILE = path.join(__dirname, '..', '..', 'data', 'password.hash');

function savePasswordHash(hash) {
  fs.writeFileSync(PASSWORD_FILE, hash, { mode: 0o600 }); // Owner read/write only
}
```

### Loading Password Hash on Startup

```javascript
// Called at module load time — synchronous is acceptable here
function loadPasswordHash() {
  if (fs.existsSync(PASSWORD_FILE)) {
    passwordHash = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
    return true;
  }
  return false;
}
loadPasswordHash();
```

### Data Directory Bootstrap

```javascript
// Ensures data/ exists before attempting file writes
const dataDir = path.dirname(PASSWORD_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```

## In-Memory Session Store

Express-session uses its default `MemoryStore`. This means:

- All sessions live in Node.js heap memory
- Sessions are lost on process restart (users must re-login)
- No session sharing across multiple Node.js processes
- No session persistence across deploys

For this single-server, single-admin NOC display app, this is the right trade-off. The admin re-authenticates rarely, and dashboard users need no sessions.

### WARNING: MemoryStore Leaks in Production at Scale

**The Problem:** `MemoryStore` has no automatic pruning of expired sessions. Express-session's default store keeps sessions in a plain object and only checks expiry on access, not proactively.

**Why This Matters Here:** With a single admin user and 24h session TTL, this is a non-issue. If the app ever scales to multiple users, switch to `connect-redis`, `connect-mongo`, or `connect-lru`.

**When You Might Be Tempted:** Adding user accounts or API key sessions.

## In-Memory Settings Store

```javascript
// src/routes/settings.js — plain object, no persistence
const settings = {
  heading: 'OCDE Threat Map',
  httpBindAddress: '127.0.0.1',
  syslogBindAddress: '127.0.0.1',
  httpPort: 3000,
  syslogPort: 514,
};
```

Settings reset to defaults on restart. Network binding changes require restart to take effect anyway, so persistence adds no value here.

## Dead Letter Queue (DLQ)

Failed syslog parse attempts are persisted to disk for post-mortem analysis. See the **syslog-parser** skill for parse error handling.

```javascript
// src/utils/error-handler.js
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      rawMessage: rawMessage.substring(0, 500), // Truncate for safety
      retryCount: 0
    };
    this.failedMessages.push(entry);
    fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
  }
}
```

JSONL format (one JSON object per line) enables `tail -f` monitoring and line-by-line parsing without loading the entire file.

## WARNING: Anti-Patterns

### Sync File I/O in Hot Paths

**The Problem:**

```javascript
// BAD — blocking the event loop on every password check
const hash = fs.readFileSync(PASSWORD_FILE, 'utf8');
```

**Why This Breaks:** In a hot path (e.g., inside a request handler called frequently), synchronous I/O blocks all other connections. See the **node** skill for event loop patterns.

**The Fix:** This codebase correctly uses sync I/O only at startup (`loadPasswordHash`) and for DLQ writes (acceptable — failures are rare). The in-memory `passwordHash` variable serves all runtime reads. NEVER add sync reads in request handlers.

### Missing data/ Directory

**The Problem:** Deploying without the `data/` directory causes `ENOENT` on first password change.

**The Fix:** The module bootstraps the directory at load time:

```javascript
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
```

### Deployment Checklist

Copy this checklist and track progress:
- [ ] `data/` directory exists and is writable
- [ ] `data/password.hash` has mode 0600 (if it exists)
- [ ] `logs/` directory exists and is writable
- [ ] `public/uploads/` directory exists and is writable
- [ ] `SESSION_SECRET` env var is set (32+ hex chars)
- [ ] `NODE_ENV=production` if serving over HTTPS

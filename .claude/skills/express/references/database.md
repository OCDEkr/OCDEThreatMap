# Database Reference

## Contents
- Architecture Decision
- In-Memory State Patterns
- File Persistence
- Dead Letter Queue
- Caching Layer
- Anti-Patterns

## Architecture Decision

**This codebase has NO database by design.** It is a real-time visualization system with no historical analysis requirement.

| Data | Storage | Persistence | Rationale |
|------|---------|-------------|-----------|
| Attack events | In-memory (event bus) | None — fire and forget | Real-time display only |
| Geo lookups | LRU cache (10K items) | None — repopulated on demand | See the **lru-cache** skill |
| Sessions | MemoryStore (default) | None — lost on restart | Single-admin, dev simplicity |
| Settings | In-memory object | None — lost on restart | Runtime config via API |
| Password hash | File (`data/password.hash`) | Survives restart | bcrypt hash, `0o600` perms |
| Failed messages | File (`logs/failed-messages.jsonl`) | Append-only log | DLQ for debugging |
| Metrics | In-memory counters | None — logged on shutdown | Reported every 10s to console |

## In-Memory State Patterns

### Metrics Counters (src/app.js)

```javascript
let totalReceived = 0;
let totalParsed = 0;
let totalFailed = 0;

eventBus.on('message', () => totalReceived++);
eventBus.on('parsed', () => totalParsed++);
eventBus.on('parse-error', () => totalFailed++);

// Periodic reporting
setInterval(() => {
  const successRate = totalReceived > 0 ? (totalParsed / totalReceived * 100).toFixed(2) : 0;
  console.log(`METRICS: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}, Rate=${successRate}%`);
}, 10000);
```

### Settings Object (src/routes/settings.js)

```javascript
const settings = {
  heading: 'OCDE Threat Map',
  httpBindAddress: '127.0.0.1',
  syslogBindAddress: '127.0.0.1',
  httpPort: 3000,
  syslogPort: 514,
};

// Exported for startup config
module.exports.getSettings = () => settings;
```

Settings validated against known keys to prevent injection:

```javascript
for (const [key, value] of Object.entries(updates)) {
  if (settings.hasOwnProperty(key)) {
    settings[key] = value;
  }
}
```

## File Persistence

### Password Hash (src/routes/change-password.js)

```javascript
const PASSWORD_FILE = path.join(__dirname, '..', '..', 'data', 'password.hash');

function savePasswordHash(hash) {
  fs.writeFileSync(PASSWORD_FILE, hash, { mode: 0o600 });
}

function loadPasswordHash() {
  if (fs.existsSync(PASSWORD_FILE)) {
    passwordHash = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
    return true;
  }
  return false;
}
```

Password hash loaded on module load. Falls back to `DASHBOARD_PASSWORD` env var if no hash file exists.

### Custom Logo (src/routes/logo.js)

Multer saves to `public/uploads/`. Old logos with different extensions cleaned up on new upload.

## Dead Letter Queue

Failed parse attempts persisted to `logs/failed-messages.jsonl` in `src/utils/error-handler.js`:

```javascript
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message || 'Unknown error',
      rawMessage: rawMessage.substring(0, 500),  // Truncate
      retryCount: 0
    };
    this.failedMessages.push(entry);
    try {
      fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
    } catch (writeErr) {
      console.error('DLQ: Failed to write:', writeErr.message);
    }
  }
}
```

### Reading DLQ for Analysis

```javascript
const dlq = new DeadLetterQueue();
const failures = dlq.loadFromFile();
console.log(`Total failures: ${failures.length}`);
```

## Caching Layer

Geo lookups cached via `lru-cache` in `src/enrichment/cache.js`. See the **lru-cache** skill for configuration. See the **maxmind** skill for the underlying lookup.

## WARNING: MemoryStore in Production

**The Problem:**

```javascript
// Current default: no session store configured
const sessionParser = session({
  secret: process.env.SESSION_SECRET,
  // No store = MemoryStore
});
```

**Why This Breaks in Production:**
1. Sessions lost on every server restart — admin must re-login
2. MemoryStore leaks memory (no automatic pruning of expired sessions)
3. Cannot scale to multiple instances

**Acceptable here because:** Single admin user, single instance, 24h session expiry. If requirements grow, add `connect-redis` or `connect-sqlite3`.

See the **express-session** skill for session store options.

## WARNING: Synchronous File I/O in DLQ

**The Problem:**

```javascript
fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
```

**Why It's Accepted:** DLQ writes are infrequent (only parse failures), durability matters more than throughput, and sync ensures the entry persists even on immediate crash.

**When to Change:** If parse failures exceed ~100/sec, switch to async buffered writes:

```javascript
const writeStream = fs.createWriteStream(path, { flags: 'a' });
writeStream.write(JSON.stringify(entry) + '\n');
```

## When to Add a Database

Consider adding persistence if requirements change to include:
- Historical attack trend analysis
- Multi-user management beyond single admin
- Multi-instance deployment (shared state)
- Audit trail or compliance logging

**Recommended:** SQLite via `better-sqlite3` for simplicity, or Redis for multi-instance sessions + caching.

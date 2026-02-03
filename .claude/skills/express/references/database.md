# Database Reference

## Contents
- Architecture Decision
- In-Memory State
- Dead Letter Queue
- When to Add Persistence
- Anti-Patterns

## Architecture Decision

**This codebase has NO database by design.** It's an in-memory real-time visualization system.

| What | Storage | Rationale |
|------|---------|-----------|
| Attack events | In-memory only | Real-time display, no history needed |
| Geo lookups | LRU cache | MaxMind file-based, cache for speed |
| Sessions | In-memory (default) | Development simplicity |
| Failed messages | File (JSONL) | Dead letter queue for debugging |

## In-Memory State

Metrics tracked in `src/app.js`:

```javascript
let totalReceived = 0;
let totalParsed = 0;
let totalFailed = 0;

eventBus.on('message', () => totalReceived++);
eventBus.on('parsed', () => totalParsed++);
eventBus.on('parse-error', () => totalFailed++);
```

## Dead Letter Queue

Failed messages persist to `logs/failed-messages.jsonl`:

```javascript
// src/utils/error-handler.js
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      rawMessage: rawMessage.substring(0, 500),
      retryCount: 0
    };
    
    // In-memory for fast access
    this.failedMessages.push(entry);
    
    // Persist to file (JSONL format)
    fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
  }
}
```

### Reading DLQ for Analysis

```javascript
const dlq = new DeadLetterQueue();
const failures = dlq.loadFromFile();

// Analyze failure patterns
const byError = failures.reduce((acc, f) => {
  acc[f.error] = (acc[f.error] || 0) + 1;
  return acc;
}, {});
```

## Caching with LRU

Geo lookups use `lru-cache`. See the **lru-cache** skill for details.

```javascript
// src/enrichment/cache.js
const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 10000,          // Max entries
  ttl: 1000 * 60 * 60  // 1 hour TTL
});
```

## When to Add Persistence

Consider adding a database if requirements change to include:
- Historical attack analysis
- Trend reporting over time
- Multi-instance deployment (shared state)
- User management beyond single admin

**Recommended approach:** SQLite for simplicity, or Redis for multi-instance.

## WARNING: Session Store in Production

**The Problem:**

```javascript
// Current: in-memory session store (default)
const sessionParser = session({
  secret: process.env.SESSION_SECRET,
  // No store configured = MemoryStore
});
```

**Why This Breaks in Production:**
1. Sessions lost on server restart
2. Memory leaks under heavy use (MemoryStore doesn't prune)
3. Cannot scale to multiple instances

**The Fix:**

```javascript
// Production: use connect-redis or similar
const RedisStore = require('connect-redis').default;
const redis = require('redis');

const redisClient = redis.createClient();

const sessionParser = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  // ...
});
```

See the **express-session** skill for session store options.

## WARNING: Synchronous File I/O

**The Problem:**

```javascript
// BAD - blocks event loop
fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
```

**Why This Is Accepted Here:**
- DLQ writes are infrequent (only on parse failures)
- Durability > performance for error logging
- Ensures entry persists even on immediate crash

**When to Change:**
If parse failures become frequent (>100/sec), switch to async buffered writes:

```javascript
// Async alternative for high-volume
const writeStream = fs.createWriteStream(path, { flags: 'a' });
writeStream.write(JSON.stringify(entry) + '\n');
```
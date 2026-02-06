# Error Handling Reference

## Contents
- Error Philosophy
- Route Error Patterns
- Multer Error Handling
- Service Error Handling
- Dead Letter Queue
- Graceful Shutdown
- Anti-Patterns

## Error Philosophy

**Never crash the pipeline.** This is a NOC display running 24/7. A malformed syslog message, a broken WebSocket client, or a failed geo lookup must NEVER bring down the application.

| Layer | Strategy | Consequence of Failure |
|-------|----------|----------------------|
| Routes | Return HTTP status + JSON error | Client sees error message |
| Parser | Emit `parse-error`, log to DLQ | Single message lost, pipeline continues |
| Enrichment | Emit with `geo: null` | Arc renders without geo data |
| WebSocket | Terminate broken client | Other clients unaffected |
| File I/O | Log error, continue | DLQ entry may be lost |
| Uncaught | Log stack trace, do NOT exit | Process stays alive |

## Route Error Patterns

### Standard JSON Error Responses

```javascript
// Input validation (400)
if (!username || !password) {
  return res.status(400).json({ success: false, error: 'Username and password are required' });
}

// Authentication failure (401) — generic message prevents enumeration
res.status(401).json({ success: false, error: 'Invalid credentials' });

// Not found (404)
res.status(404).json({ success: false, error: `Setting '${key}' not found` });

// Rate limited (429)
res.status(429).json({ success: false, error: 'Too many login attempts.' });

// Server error (500) — log details internally, generic to client
console.error('[Password] Hash error:', err);
res.status(500).json({ success: false, error: 'Failed to change password' });
```

### Session Destruction Error

```javascript
// src/routes/logout.js
req.session.destroy((err) => {
  if (err) {
    console.error('Session destruction error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
  res.clearCookie('ocde.sid');
  res.json({ success: true });
});
```

## Multer Error Handling

File upload errors require a 4-argument error middleware on the router:

```javascript
// src/routes/logo.js — MUST be last middleware on the router
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});
```

**When You'll Hit This:** Multer throws `MulterError` for file size violations. Custom `fileFilter` errors throw generic `Error`. Both must be caught.

## Service Error Handling

### Enrichment Pipeline Graceful Degradation

```javascript
enrich(event) {
  try {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', { ...event, geo: geoData });
  } catch (err) {
    console.error('[EnrichmentPipeline] Enrichment error:', err.message);
    this.eventBus.emit('enriched', { ...event, geo: null, enrichmentError: err.message });
  }
}
```

### Receiver Error Handling

```javascript
// src/app.js — socket errors logged but never terminate receiver
receiver.on('error', (err) => {
  console.error('Receiver error:', err);
});
```

### Parse Error to DLQ

```javascript
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

## Dead Letter Queue

`src/utils/error-handler.js` — dual storage: in-memory array + JSONL file:

```javascript
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message || 'Unknown error',
      rawMessage: rawMessage.substring(0, 500),
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

## Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  console.log(`Final: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}`);
  server.close(() => console.log('HTTP server closed'));
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Do NOT exit — keep pipeline alive
});
```

## WARNING: Silent Error Swallowing

**The Problem:**

```javascript
// BAD — error vanishes
try {
  const data = riskyOperation();
} catch (err) {
  // Nothing
}
```

**Why This Breaks:**
1. No visibility into failures — impossible to debug
2. Data silently lost
3. "Never crash" means "log and continue", not "ignore and continue"

**The Fix:**

```javascript
// GOOD — log context and continue
try {
  const data = riskyOperation();
} catch (err) {
  console.error('[Module] Operation failed:', err.message);
}
```

## WARNING: Leaking Internal Errors to Clients

**The Problem:**

```javascript
// BAD — stack trace sent to browser
res.status(500).json({ error: err.stack });
```

**Why This Breaks:**
1. Reveals file paths, library versions, Node.js internals
2. May expose sensitive data in error messages
3. OWASP information disclosure vulnerability

**The Fix:**

```javascript
// GOOD — log full error internally, generic message to client
console.error('[Route] getData failed:', err);
res.status(500).json({ success: false, error: 'Failed to fetch data' });
```

## WARNING: Missing Error Handler on Async Routes

**The Problem:** Express 5.x catches rejected promises in async handlers automatically, but without error middleware the default handler sends HTML.

**The Fix:**

```javascript
// GOOD — explicit try/catch returns JSON
router.post('/', async (req, res) => {
  try {
    const hash = await hashPassword(req.body.newPassword);
    res.json({ success: true });
  } catch (err) {
    console.error('[Password] Hash error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});
```

## Error Handling Checklist

Copy this checklist and track progress:
- [ ] All routes return `{ success: false, error: 'message' }` on failure
- [ ] No internal errors (stack traces, file paths) exposed to clients
- [ ] Parse failures logged to DLQ with context
- [ ] Service errors emit events or log — never swallowed silently
- [ ] SIGINT and SIGTERM handlers stop all components
- [ ] Multer routes have 4-argument error middleware
- [ ] Async routes have try/catch with JSON error responses

## Validation Loop

1. Make changes
2. Verify: `node src/app.js` starts without errors
3. Test error paths: `curl -X POST http://localhost:3000/login -H 'Content-Type: application/json' -d '{}'`
4. Expected: `{"success":false,"error":"Username and password are required"}`
5. If unexpected response, check middleware order and error handlers, then repeat from step 2

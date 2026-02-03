# Error Handling Reference

## Contents
- Error Philosophy
- Route Error Handling
- Service Error Handling
- Dead Letter Queue
- Graceful Shutdown
- Anti-Patterns

## Error Philosophy

**Never crash the pipeline.** This is a real-time visualization system. A malformed syslog message should not bring down the entire application.

| Layer | Strategy |
|-------|----------|
| Routes | Return appropriate HTTP status, log error |
| Services | Emit error event, continue processing |
| Sockets | Log error, terminate single client, continue |
| Parse failures | Log to DLQ, continue processing |

## Route Error Handling

### Standard Error Response

```javascript
// Validation error
res.status(400).json({ error: 'Username required' });

// Auth error
res.status(401).json({ success: false, error: 'Invalid credentials' });

// Server error
res.status(500).json({ error: 'Operation failed' });
```

### Session Destruction Error

```javascript
router.post('/', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});
```

## Service Error Handling

### Graceful Degradation Pattern

```javascript
// src/enrichment/enrichment-pipeline.js
enrich(event) {
  try {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', { ...event, geo: geoData });
  } catch (err) {
    console.error('[EnrichmentPipeline] Enrichment error:', err.message);
    
    // Emit event anyway with error flag
    this.eventBus.emit('enriched', {
      ...event,
      geo: null,
      enrichmentError: err.message
    });
    
    this.emit('enrichment:error', { event, error: err });
  }
}
```

### Receiver Error Handling

```javascript
receiver.on('error', (err) => {
  console.error('Receiver error:', err);
  // Don't crash - continue operation
});
```

## Dead Letter Queue

Failed parse attempts go to `logs/failed-messages.jsonl`:

```javascript
// src/utils/error-handler.js
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message || 'Unknown error',
      rawMessage: rawMessage.substring(0, 500),  // Truncate large messages
      retryCount: 0
    };
    
    this.failedMessages.push(entry);
    
    try {
      fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
    } catch (writeErr) {
      // File write failure shouldn't crash app
      console.error('DLQ: Failed to write to file:', writeErr.message);
    }
  }
}
```

### Wiring DLQ to Parse Errors

```javascript
// src/app.js
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

## Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  // Log final metrics
  console.log(`Final: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}`);
  
  // Stop components in order
  server.close(() => console.log('HTTP server closed'));
  receiver.stop();
  enrichmentPipeline.shutdown();
  
  process.exit(0);
});

// Also handle SIGTERM
process.on('SIGTERM', () => {
  server.close();
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});
```

### Uncaught Exception Handler

```javascript
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit - try to continue (controversial but intentional here)
});
```

## WARNING: Silent Error Swallowing

**The Problem:**

```javascript
// BAD - error disappears silently
try {
  const data = riskyOperation();
} catch (err) {
  // Nothing - error is swallowed
}
```

**Why This Breaks:**
1. No visibility into failures
2. Impossible to debug production issues
3. Data silently lost

**The Fix:**

```javascript
// GOOD - log and continue
try {
  const data = riskyOperation();
} catch (err) {
  console.error('Operation failed:', err.message);
  // Either rethrow, emit event, or handle explicitly
}
```

## WARNING: Leaking Internal Errors

**The Problem:**

```javascript
// BAD - exposing internals to client
router.get('/data', (req, res) => {
  try {
    const data = getData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.stack });  // Exposes internals!
  }
});
```

**Why This Breaks:**
1. Security risk - reveals file paths, library versions
2. Confuses users with technical details
3. May expose sensitive data

**The Fix:**

```javascript
// GOOD - log internally, return generic message
router.get('/data', (req, res) => {
  try {
    const data = getData();
    res.json(data);
  } catch (err) {
    console.error('getData failed:', err);  // Full details in logs
    res.status(500).json({ error: 'Failed to fetch data' });  // Generic to client
  }
});
```

## Error Handling Checklist

Copy this checklist and track progress:
- [ ] All routes have error responses with appropriate status codes
- [ ] Services emit events on error (don't throw into void)
- [ ] Parse failures logged to DLQ with context
- [ ] SIGINT/SIGTERM handlers for graceful shutdown
- [ ] No internal errors exposed to clients
- [ ] Console errors include enough context for debugging
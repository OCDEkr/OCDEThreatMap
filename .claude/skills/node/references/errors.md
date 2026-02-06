# Node.js Error Handling Reference

## Contents
- Error Handling Philosophy
- Try-Catch Patterns
- Dead Letter Queue
- Process-Level Handlers
- Socket and WebSocket Errors
- Anti-Patterns

## Error Handling Philosophy

**NEVER crash on malformed input.** This is a NOC display system — a single bad syslog message must not take down the visualization for an entire operations center. Log errors, emit events, continue processing.

Three error strategies:
1. **Try-catch with fallback** — enrichment returns `geo: null` on failure
2. **Error event emission** — `parse-error` events route to the dead letter queue
3. **Process-level handlers** — `uncaughtException` logs but does not exit

## Try-Catch Patterns

### Fatal Errors (Startup Only)

```javascript
// src/app.js — failure here means the app cannot function
async function start() {
  try {
    await enrichmentPipeline.initialize();
    const addr = await receiver.listen();
  } catch (err) {
    if (err.code === 'EACCES') {
      console.error('Permission denied: port 514 requires root');
      console.error('Try: SYSLOG_PORT=5514 node src/app.js');
    }
    process.exit(1);  // Fatal — cannot recover
  }
}
```

### Graceful Degradation (Runtime)

```javascript
// src/enrichment/enrichment-pipeline.js
enrich(event) {
  const startTime = Date.now();
  try {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', {
      ...event,
      geo: geoData,
      enrichmentTime: Date.now() - startTime
    });
  } catch (err) {
    console.error('Enrichment error:', err.message);
    // Emit with error flag — dashboard still shows attack, just without geo
    this.eventBus.emit('enriched', {
      ...event,
      geo: null,
      enrichmentError: err.message,
      enrichmentTime: Date.now() - startTime
    });
  }
}
```

### Nested Try-Catch (DLQ Durability)

```javascript
// src/utils/error-handler.js — outer catch protects app stability
add(rawMessage, error) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message || 'Unknown error',
      rawMessage: rawMessage.substring(0, 500)  // Truncate for safety
    };
    this.failedMessages.push(entry);
    try {
      fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
    } catch (writeErr) {
      console.error('DLQ file write failed:', writeErr.message);
    }
  } catch (err) {
    console.error('DLQ error:', err.message);
  }
}
```

**Note:** `appendFileSync` is intentional — durability over throughput on this non-critical error path.

## Dead Letter Queue

Failed messages persist to `logs/failed-messages.jsonl` (one JSON object per line).

**Wired in app.js:**

```javascript
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

## Process-Level Handlers

### Uncaught Exception Handler

```javascript
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Do not exit — NOC display must stay alive
});
```

**When to exit vs. continue:** This app continues because it has no persistent state to corrupt. For apps with database transactions, `process.exit(1)` after logging is safer.

## Socket and WebSocket Errors

### UDP Socket Errors

```javascript
this.socket.on('error', (err) => {
  console.error('Socket error:', err.message);
  this.emit('error', err);  // Propagate to app.js
});
```

### WebSocket Per-Client Error Isolation

One broken client must never affect others. See the **websocket** skill for full broadcast patterns.

```javascript
for (const client of wss.clients) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      client.send(messageStr);
    } catch (err) {
      client.terminate();  // Kill broken connection, continue to next
    }
  }
}
```

## Error Propagation Flow

```
Parser error       -> eventBus.emit('parse-error') -> DLQ in app.js
Socket error       -> receiver.emit('error')       -> console.error in app.js
Enrichment error   -> enriched event with geo:null  -> dashboard shows attack without location
WebSocket failure  -> client.terminate()            -> other clients unaffected
```

## Anti-Patterns

### WARNING: Silent Error Swallowing

**The Problem:**

```javascript
// BAD — catch with no logging
try { const geo = geoLocator.get(ip); }
catch (err) { /* silently ignored */ }
```

**Why This Breaks:**
1. Impossible to debug — lookups fail with no trace
2. Cache metrics become misleading
3. Dashboard shows no arcs with no indication why

**The Fix:**

```javascript
// GOOD — log, return fallback
try { return geoLocator.get(ip); }
catch (err) {
  console.error(`Geo lookup failed for ${ip}:`, err.message);
  return null;
}
```

### WARNING: Unhandled EventEmitter Error Event

**The Problem:**

```javascript
// BAD — CRASHES Node.js immediately
const emitter = new EventEmitter();
emitter.emit('error', new Error('socket failure'));
```

**Why This Breaks:** Node.js throws unhandled error events as uncaught exceptions. No warning, instant crash.

**The Fix:**

```javascript
// GOOD — register handler BEFORE any code that might emit errors
receiver.on('error', (err) => {
  console.error('Receiver error:', err.message);
});
const addr = await receiver.listen();  // Now safe
```

## Error Handling Review Checklist

Copy this checklist when reviewing error handling:

- [ ] All EventEmitters have error event handlers registered
- [ ] UDP/WebSocket sockets have `.on('error')` before `.bind()`/`.listen()`
- [ ] Startup failures call `process.exit(1)` with descriptive message
- [ ] Runtime failures log + continue (never crash the pipeline)
- [ ] Failed messages route to dead letter queue via `parse-error`
- [ ] SIGINT and SIGTERM both trigger graceful shutdown
- [ ] `uncaughtException` handler logs error with stack trace
- [ ] WebSocket send failures isolate the broken client
- [ ] Enrichment failures emit event with `geo: null` (not silently dropped)

## Debugging Error Handling

1. Add `console.error` to the suspected silent catch block
2. Run: `node test/send-random-attacks.js` to generate traffic
3. Check console for error messages
4. If errors appear, fix the root cause
5. Verify error rate in metrics output (logged every 10s)
6. Repeat steps 2-5 until error rate is acceptable

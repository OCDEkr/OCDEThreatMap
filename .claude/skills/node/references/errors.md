# Node.js Error Handling Reference

## Contents
- Error Handling Philosophy
- Try-Catch Patterns
- Dead Letter Queue
- Process-Level Handling
- Socket Error Handling

## Error Handling Philosophy

**Never crash on malformed input.** Log errors, emit events, continue processing.

```javascript
// GOOD - Graceful degradation
parse(rawMessage) {
  try {
    const parsed = parser(cleanedMessage);
    if (!parsed) throw new Error('Parser returned empty result');
    return parsed;
  } catch (err) {
    console.error('Parse error:', err.message);
    eventBus.emit('parse-error', {
      error: err.message,
      rawMessage: rawMessage,
      timestamp: new Date()
    });
    return null;  // Don't crash
  }
}
```

## Try-Catch Patterns

### Async Operation Errors

```javascript
async function start() {
  try {
    await enrichmentPipeline.initialize();
    const addr = await receiver.listen();
  } catch (err) {
    console.error('Failed to start:', err);
    
    // Handle specific error codes
    if (err.code === 'EACCES') {
      console.error('Permission denied: Port requires root');
    }
    
    process.exit(1);  // Fatal - can't recover
  }
}
```

### Enrichment with Fallback

```javascript
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
    
    // Emit with error flag (graceful degradation)
    this.eventBus.emit('enriched', {
      ...event,
      geo: null,
      enrichmentError: err.message,
      enrichmentTime: Date.now() - startTime
    });
  }
}
```

## Dead Letter Queue

**When:** Persist failed messages for analysis and potential retry

```javascript
class DeadLetterQueue {
  constructor() {
    this.failedMessages = [];
    this.failedMessagesFile = path.join(logsDir, 'failed-messages.jsonl');
  }

  add(rawMessage, error) {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
        rawMessage: rawMessage.substring(0, 500),  // Truncate
        retryCount: 0
      };

      this.failedMessages.push(entry);

      // JSONL format - one JSON per line
      fs.appendFileSync(
        this.failedMessagesFile,
        JSON.stringify(entry) + '\n'
      );
    } catch (err) {
      // Prioritize stability over DLQ durability
      console.error('DLQ error:', err.message);
    }
  }
}
```

**Usage:**

```javascript
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

## Process-Level Handling

### Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  // Log final metrics
  console.log(`Final: Received=${totalReceived}, Failed=${totalFailed}`);
  
  // Close server
  server.close(() => console.log('HTTP server closed'));
  
  // Stop components
  receiver.stop();
  enrichmentPipeline.shutdown();
  
  process.exit(0);
});
```

### Uncaught Exception Handler

```javascript
// Last resort - try to continue
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit - try to continue
});
```

### WARNING: Not Handling uncaughtException

**The Problem:**

```javascript
// BAD - Process crashes with no logging
// (no uncaughtException handler)
```

**Why This Breaks:**
1. No error logging - can't debug production issues
2. No cleanup - connections left hanging
3. Silent failure - monitoring may not catch it

**The Fix:**

```javascript
// GOOD - Log and decide whether to exit
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  // For this app: try to continue
  // For critical apps: process.exit(1)
});
```

## Socket Error Handling

### WARNING: Missing Socket Error Handler

**The Problem:**

```javascript
// BAD - Unhandled socket error crashes process
this.socket = dgram.createSocket('udp4');
this.socket.bind(514);
// No error handler - EADDRINUSE crashes Node
```

**The Fix:**

```javascript
// GOOD - Handle socket errors
this.socket.on('error', (err) => {
  console.error('Socket error:', err.message);
  this.emit('error', err);  // Propagate to caller
  // Don't crash - socket may still be usable
});
```

### WebSocket Send Errors

```javascript
for (const client of wss.clients) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      client.send(message);
      successCount++;
    } catch (err) {
      console.error('Send failed:', err.message);
      failureCount++;
      client.terminate();  // Clean up broken connection
    }
  }
}
```

## Error Propagation Pattern

**Emit errors on dedicated event, don't throw:**

```javascript
// In parser
eventBus.emit('parse-error', { error: err.message, rawMessage });

// In app.js - centralized handling
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

## Validation Workflow

Copy this checklist for error handling review:

- [ ] All EventEmitters have `error` event handlers
- [ ] Socket operations have error handlers
- [ ] Async operations are wrapped in try-catch
- [ ] Failed operations emit error events (not throw)
- [ ] SIGINT/SIGTERM handlers clean up resources
- [ ] uncaughtException handler logs errors
- [ ] Dead letter queue captures failed messages
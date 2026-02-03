# Node.js Patterns Reference

## Contents
- Event-Driven Architecture
- Async Initialization
- Graceful Shutdown
- Module Organization
- Anti-Patterns

## Event-Driven Architecture

This codebase uses a central EventEmitter as a message bus between decoupled components:

```javascript
// src/events/event-bus.js - Singleton pattern
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;
```

**Pipeline wiring in app.js:**

```javascript
const eventBus = require('./events/event-bus');

// Wire receiver -> parser
receiver.on('message', (data) => eventBus.emit('message', data));

// Wire parser -> enrichment (via eventBus internally)
eventBus.on('parsed', (event) => totalParsed++);

// Wire enrichment -> broadcast
eventBus.on('enriched', (event) => broadcastAttack(wss, event));
```

### WARNING: Missing Error Handler on EventEmitter

**The Problem:**

```javascript
// BAD - Missing error handler causes process crash
const emitter = new EventEmitter();
emitter.emit('error', new Error('oops'));  // CRASHES NODE
```

**Why This Breaks:**
1. Node.js treats unhandled `error` events as fatal exceptions
2. Process exits immediately with no cleanup
3. All connected clients disconnect without notification

**The Fix:**

```javascript
// GOOD - Always handle error events
receiver.on('error', (err) => {
  console.error('Receiver error:', err);
  // Don't crash - continue operation
});
```

## Async Initialization

**When:** Loading databases, starting servers, binding sockets

```javascript
async function start() {
  try {
    // Initialize async dependencies first
    await enrichmentPipeline.initialize();
    
    // Start HTTP server
    server.listen(3000, () => {
      console.log('HTTP server listening on port 3000');
    });
    
    // Start UDP receiver (returns Promise)
    const addr = await receiver.listen();
    console.log(`Listening on: ${addr.address}:${addr.port}`);
    
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}
start();
```

## Graceful Shutdown

**When:** Process receives SIGINT (Ctrl+C) or SIGTERM

```javascript
process.on('SIGINT', () => {
  console.log('Shutting down...');
  
  // Log final metrics before exit
  console.log(`Final: Received=${totalReceived}, Parsed=${totalParsed}`);
  
  // Close server (stops accepting new connections)
  server.close(() => console.log('HTTP server closed'));
  
  // Stop UDP receiver
  receiver.stop();
  
  // Cleanup async resources
  enrichmentPipeline.shutdown();
  
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  receiver.stop();
  process.exit(0);
});
```

### WARNING: Not Cleaning Up Intervals

**The Problem:**

```javascript
// BAD - Interval keeps running, prevents clean exit
this.metricsInterval = setInterval(() => {
  console.log(this.getMetrics());
}, 30000);
// No cleanup method
```

**The Fix:**

```javascript
// GOOD - Provide cleanup method
startMetricsLogging(intervalMs = 30000) {
  this.metricsInterval = setInterval(() => {
    console.log(this.getMetrics());
  }, intervalMs);
}

stopMetricsLogging() {
  if (this.metricsInterval) {
    clearInterval(this.metricsInterval);
    this.metricsInterval = null;
  }
}
```

## Module Organization

**Import order (this codebase):**

```javascript
// 1. Node.js built-ins
const http = require('http');
const path = require('path');
const dgram = require('dgram');
const { EventEmitter } = require('events');

// 2. External packages
const express = require('express');
const { WebSocketServer } = require('ws');
const { LRUCache } = require('lru-cache');

// 3. Local modules
const eventBus = require('./events/event-bus');
const { SyslogReceiver } = require('./receivers/udp-receiver');
```

## Anti-Patterns

### WARNING: Synchronous File I/O in Request Path

**The Problem:**

```javascript
// BAD - Blocks event loop during file write
fs.writeFileSync(this.failedMessagesFile, JSON.stringify(entry));
```

**Why This Breaks:**
1. Blocks all other requests while writing
2. Destroys throughput under high load
3. UDP messages may be dropped during blocking I/O

**When Acceptable:**
- Dead letter queue uses sync writes intentionally for durability guarantees
- Only for non-critical paths that don't affect main throughput

**The Fix for Hot Paths:**

```javascript
// GOOD - Async write for high-throughput paths
await fs.promises.appendFile(logFile, JSON.stringify(entry) + '\n');
```

### WARNING: Throwing in Event Handlers

**The Problem:**

```javascript
// BAD - Unhandled error crashes the process
eventBus.on('parsed', (event) => {
  if (!event.sourceIP) throw new Error('Missing IP');
});
```

**The Fix:**

```javascript
// GOOD - Catch errors, emit error event, continue
eventBus.on('parsed', (event) => {
  try {
    if (!event.sourceIP) {
      eventBus.emit('parse-error', { error: 'Missing IP', event });
      return;
    }
    // process event...
  } catch (err) {
    console.error('Handler error:', err);
  }
});
```
# Node.js Patterns Reference

## Contents
- Event-Driven Pipeline Architecture
- Async Initialization Pattern
- Promise Wrappers for Callback APIs
- Timer and Interval Management
- Graceful Shutdown
- Anti-Patterns

## Event-Driven Pipeline Architecture

Components communicate through a shared EventEmitter singleton, never by importing each other directly.

**Pipeline wiring in `src/app.js`:**

```javascript
const eventBus = require('./events/event-bus');

// Stage 1: UDP receiver emits to event bus
receiver.on('message', (data) => eventBus.emit('message', data));

// Stage 2: Parser listens internally to eventBus 'message'
// Stage 3: Enrichment listens internally to eventBus 'parsed'

// Stage 4: Enriched events broadcast to WebSocket clients
eventBus.on('enriched', (event) => broadcastAttack(wss, event));

// Error sidecar: parse failures go to dead letter queue
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});
```

Each stage only knows about the event bus. Replacing the parser or adding a new consumer requires zero changes to existing components.

### Dual Event Emission

Components emit to both the shared bus (pipeline flow) and locally (metrics):

```javascript
// src/enrichment/enrichment-pipeline.js
this.eventBus.emit('enriched', enrichedEvent);  // Pipeline flow
this.emit('enriched', enrichedEvent);            // Local metrics
```

## Async Initialization Pattern

**When:** Components need async setup (database loading, socket binding) but synchronous operation after.

```javascript
class CachedGeoLocator {
  constructor() {
    this.geoLocator = new GeoLocator();
    this.cache = new LRUCache({ max: 10000, ttl: 3600000 });
  }

  async initialize() {
    await this.geoLocator.initialize();  // Loads MaxMind DB into memory
  }

  get(ip) {  // Synchronous after init — fast path
    if (this.cache.has(ip)) return this.cache.get(ip);
    const result = this.geoLocator.get(ip);
    this.cache.set(ip, result);  // Cache even null results
    return result;
  }
}
```

See the **maxmind** skill for GeoLite2 database initialization. See the **lru-cache** skill for cache configuration.

## Promise Wrappers for Callback APIs

**When:** Node.js APIs use callbacks but you need async/await integration.

```javascript
// src/receivers/udp-receiver.js — wrapping dgram.bind()
listen() {
  return new Promise((resolve, reject) => {
    this.socket = dgram.createSocket({
      type: 'udp4',
      recvBufferSize: 33554432  // 32MB buffer for high-volume traffic
    });
    this.socket.on('listening', () => resolve(this.socket.address()));
    this.socket.on('error', (err) => reject(err));
    this.socket.bind(this.port, this.address);
  });
}
```

```javascript
// src/websocket/auth-handler.js — wrapping Express session middleware
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve) => {
    sessionParser(request, {}, () => {
      resolve(request.session?.authenticated ? request.session : null);
    });
  });
}
```

See the **express-session** skill for session middleware. See the **websocket** skill for upgrade handling.

## Timer and Interval Management

**Always provide cleanup methods.** Orphaned intervals prevent clean shutdown and leak memory.

```javascript
// GOOD — src/enrichment/cache.js
startMetricsLogging(intervalMs = 30000) {
  if (this.metricsInterval) return;  // Prevent duplicate intervals
  this.metricsInterval = setInterval(() => {
    const metrics = this.getMetrics();
    console.log(`[GeoCache] Hit Rate: ${metrics.hitRate}%`);
  }, intervalMs);
}

stopMetricsLogging() {
  if (this.metricsInterval) {
    clearInterval(this.metricsInterval);
    this.metricsInterval = null;
  }
}
```

**Batching pattern** — lazy timer creation with size-based early flush:

```javascript
// src/websocket/attack-broadcaster.js
if (!batchTimer) {
  batchTimer = setInterval(flushBatch, 100);  // 100ms batch window
}
if (eventBatch.length >= 50) flushBatch();  // Flush early if full
```

## Graceful Shutdown

**Both SIGINT and SIGTERM must be handled.** SIGINT from Ctrl+C, SIGTERM from process managers and containers.

```javascript
process.on('SIGINT', () => {
  console.log(`Final: Received=${totalReceived}, Parsed=${totalParsed}`);
  server.close(() => console.log('HTTP server closed'));
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});
```

## Anti-Patterns

### WARNING: Throwing in Event Handlers

**The Problem:**

```javascript
// BAD — Unhandled throw crashes the process
eventBus.on('parsed', (event) => {
  if (!event.sourceIP) throw new Error('Missing IP');
});
```

**Why This Breaks:**
1. EventEmitter does not catch errors from listeners
2. Becomes an uncaughtException — may crash the entire NOC display
3. One bad syslog message kills the whole pipeline

**The Fix:**

```javascript
// GOOD — Catch errors, emit error event, continue
eventBus.on('parsed', (event) => {
  try {
    if (!event.sourceIP) {
      eventBus.emit('parse-error', { error: 'Missing IP', rawMessage: event.raw });
      return;
    }
  } catch (err) {
    console.error('Handler error:', err);
  }
});
```

### WARNING: Missing Error Event Handler

**The Problem:**

```javascript
// BAD — Emitting 'error' with no handler crashes Node.js
const emitter = new EventEmitter();
emitter.emit('error', new Error('oops'));  // CRASHES PROCESS
```

**Why This Breaks:** Node.js treats unhandled error events as fatal exceptions by design.

**The Fix:** Always register an error handler before any code that might emit one:

```javascript
receiver.on('error', (err) => {
  console.error('Receiver error:', err.message);
});
```

## New Component Checklist

Copy this checklist when adding pipeline components:

- [ ] Component extends EventEmitter (if it emits events)
- [ ] Error event handler registered before listen()/bind()
- [ ] Async init wrapped in try-catch with process.exit(1) on fatal failure
- [ ] All setInterval calls have corresponding cleanup in shutdown
- [ ] Event handlers wrapped in try-catch (never throw in handlers)
- [ ] SIGINT and SIGTERM both handled

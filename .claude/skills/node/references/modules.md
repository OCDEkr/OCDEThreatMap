# Node.js Modules Reference

## Contents
- CommonJS Export Patterns
- Import Order
- Singleton Pattern
- Module-Level State
- Circular Dependency Prevention
- Async Module Initialization
- Anti-Patterns

## CommonJS Export Patterns

Three export styles. NEVER mix styles within a module.

### Named Class Export

**When:** Stateful components that callers instantiate.

```javascript
// src/receivers/udp-receiver.js
const { EventEmitter } = require('events');

class SyslogReceiver extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 514;
  }
}
module.exports = { SyslogReceiver };

// Usage
const { SyslogReceiver } = require('./receivers/udp-receiver');
const receiver = new SyslogReceiver({ port: 5514 });
```

### Named Function Export

**When:** Stateless utility functions.

```javascript
// src/utils/security.js
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

module.exports = { hashPassword, verifyPassword, safeCompare, logSecurityEvent };
```

### Direct Instance Export (Singleton)

**When:** Exactly one instance needed across the entire process.

```javascript
// src/events/event-bus.js
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;  // Instance, not class

// Every require() returns the SAME object
const eventBus = require('./events/event-bus');
```

## Import Order

Enforced throughout `src/`:

```javascript
// 1. Node.js built-ins
const http = require('http');
const path = require('path');
const dgram = require('dgram');
const { EventEmitter } = require('events');

// 2. External packages
const express = require('express');
const { WebSocketServer } = require('ws');
const maxmind = require('maxmind');

// 3. Local modules
const eventBus = require('./events/event-bus');
const { SyslogReceiver } = require('./receivers/udp-receiver');
const { EnrichmentPipeline } = require('./enrichment/enrichment-pipeline');
```

## Module-Level State

**When:** Functions share state that outlives any single call (WebSocket refs, batch buffers).

```javascript
// src/websocket/attack-broadcaster.js
let eventBatch = [];
let batchTimer = null;
let wssRef = null;
let totalBroadcast = 0;

function broadcastAttack(wss, event) {
  wssRef = wss;
  eventBatch.push(formatEvent(event));
  if (!batchTimer) batchTimer = setInterval(flushBatch, 100);
}

module.exports = { broadcastAttack, getBatchStats, stopBatching };
```

See the **websocket** skill for broadcast implementation details.

## Circular Dependency Prevention

**Structure:** `app.js` is the sole wiring point. Modules communicate through the event bus, never by requiring each other.

```
app.js  -->requires-->  event-bus.js (singleton)
app.js  -->requires-->  udp-receiver.js    --emits-->   event-bus
app.js  -->requires-->  palo-alto-parser.js --listens--> event-bus
app.js  -->requires-->  enrichment-pipeline.js --listens--> event-bus
app.js  -->requires-->  broadcaster.js     --listens--> event-bus
```

### WARNING: Direct Cross-Module Dependencies

**The Problem:**

```javascript
// BAD — parser requires broadcaster, broadcaster requires parser = CYCLE
// parser.js
const { broadcast } = require('./websocket/broadcaster');
// broadcaster.js
const { parse } = require('./parsers/palo-alto-parser');
```

**Why This Breaks:**
1. CommonJS resolves cycles by returning partially-loaded module — values are undefined
2. Fails silently — no error, just "undefined is not a function" at runtime
3. Breaks the event-driven decoupling guarantees

**The Fix:**

```javascript
// GOOD — Both communicate through event bus (no cycle)
// parser.js
eventBus.emit('parsed', event);

// broadcaster.js
eventBus.on('enriched', (event) => broadcastAttack(wss, event));
```

## Async Module Initialization

**Pattern:** Constructor sets up state synchronously. `initialize()` handles async setup. Separates object creation from I/O.

```javascript
// src/enrichment/enrichment-pipeline.js
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.geoLocator = new CachedGeoLocator();  // Sync
  }

  async initialize() {
    await this.geoLocator.initialize();  // Async — loads MaxMind DB
    this.geoLocator.startMetricsLogging(30000);
    this.eventBus.on('parsed', (event) => this.enrich(event));
  }

  shutdown() {
    this.geoLocator.stopMetricsLogging();
  }
}
module.exports = { EnrichmentPipeline };
```

### WARNING: Forgetting to Await initialize()

**The Problem:**

```javascript
// BAD — pipeline operates without loaded database
const pipeline = new EnrichmentPipeline(eventBus);
pipeline.initialize();  // Missing await! Returns unresolved Promise
```

**Why This Breaks:**
1. `geoLocator.get()` throws "not initialized" or returns null for every IP
2. All enriched events have `geo: null` — globe shows no arcs
3. No error thrown — app appears to work but renders nothing

**The Fix:** Always await in the `start()` function:

```javascript
async function start() {
  await pipeline.initialize();  // Block until ready
}
```

## Directory Convention

```
src/
  app.js                     # Entry point — wires all modules
  events/                    # Shared communication
  receivers/                 # Input (UDP syslog)
  parsers/                   # Data transformation
  enrichment/                # Data augmentation
  websocket/                 # Output (real-time broadcast)
  middleware/                # Express middleware
  routes/                    # HTTP route handlers
  utils/                     # Stateless utilities
```

See the **express** skill for route and middleware organization.

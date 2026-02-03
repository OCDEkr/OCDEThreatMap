# Node.js Modules Reference

## Contents
- CommonJS Patterns
- Module Organization
- Singleton Pattern
- Export Conventions

## CommonJS Patterns

This codebase uses CommonJS (not ES modules):

```javascript
// Importing
const { EventEmitter } = require('events');
const express = require('express');
const { SyslogReceiver } = require('./receivers/udp-receiver');

// Exporting (class)
class PaloAltoParser extends EventEmitter { }
module.exports = { PaloAltoParser };

// Exporting (singleton)
const eventBus = new EventEmitter();
module.exports = eventBus;

// Exporting (functions)
function broadcast(data) { }
function wireEventBroadcast(wss) { }
module.exports = { broadcast, wireEventBroadcast };
```

## Module Organization

**Directory structure:**

```
src/
├── app.js                    # Entry point - wires everything
├── events/
│   └── event-bus.js          # Singleton EventEmitter
├── receivers/
│   └── udp-receiver.js       # UDP socket handling
├── parsers/
│   └── palo-alto-parser.js   # Syslog parsing
├── enrichment/
│   ├── geolocation.js        # MaxMind wrapper
│   ├── cache.js              # LRU cache wrapper
│   └── enrichment-pipeline.js # Coordinates enrichment
├── websocket/
│   ├── ws-server.js          # WebSocket setup
│   ├── broadcaster.js        # Event broadcast
│   └── attack-broadcaster.js # Attack-specific formatting
├── middleware/
│   ├── session.js            # Express session config
│   └── auth-check.js         # Route auth middleware
├── routes/
│   ├── login.js              # POST /login
│   └── logout.js             # POST /logout
└── utils/
    ├── error-handler.js      # Dead letter queue
    └── ip-matcher.js         # OCDE IP range matching
```

## Singleton Pattern

**When:** Shared state across modules (event bus, config)

```javascript
// src/events/event-bus.js
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;  // Export instance, not class

// Usage in other modules
const eventBus = require('./events/event-bus');
eventBus.on('parsed', handler);  // Same instance everywhere
```

### WARNING: Accidental Multiple Instances

**The Problem:**

```javascript
// BAD - Exports class, creates new instance each import
module.exports = { EventBus: new EventEmitter() };

// In another file - different instance!
const { EventBus } = require('./event-bus');
```

**The Fix:**

```javascript
// GOOD - Export the instance directly
const eventBus = new EventEmitter();
module.exports = eventBus;
```

## Module-Level State

**When:** WebSocket server reference needed by multiple functions

```javascript
// src/websocket/broadcaster.js
let wss = null;  // Module-level state

function broadcast(data) {
  if (!wss) {
    console.error('WebSocket server not initialized');
    return;
  }
  // use wss...
}

function wireEventBroadcast(webSocketServer) {
  wss = webSocketServer;  // Set on initialization
  eventBus.on('enriched', (event) => {
    broadcastAttack(wss, event);
  });
}

module.exports = { broadcast, wireEventBroadcast };
```

## Circular Dependency Prevention

**Structure:** Entry point (app.js) wires dependencies, modules don't require each other cyclically.

```javascript
// app.js - Central wiring point
const eventBus = require('./events/event-bus');
const { SyslogReceiver } = require('./receivers/udp-receiver');
const { PaloAltoParser } = require('./parsers/palo-alto-parser');
const { EnrichmentPipeline } = require('./enrichment/enrichment-pipeline');

// Wire components together
receiver.on('message', (data) => eventBus.emit('message', data));
// Parser internally listens to eventBus
// EnrichmentPipeline internally listens to eventBus
```

### WARNING: Direct Cross-Module Dependencies

**The Problem:**

```javascript
// BAD - parser.js requires broadcaster.js
// broadcaster.js requires parser.js
// = Circular dependency
```

**The Fix:**

```javascript
// GOOD - Both require event-bus.js (no cycle)
// Parser emits to eventBus
eventBus.emit('parsed', event);

// Broadcaster listens to eventBus
eventBus.on('parsed', handleParsed);
```

## Async Module Initialization

**Pattern:** Class with `initialize()` method for async setup

```javascript
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.geoLocator = new CachedGeoLocator();
  }

  async initialize() {
    await this.geoLocator.initialize();  // Load MaxMind DB
    this.eventBus.on('parsed', (event) => this.enrich(event));
    console.log('EnrichmentPipeline initialized');
  }
}
```

**Usage:**

```javascript
const pipeline = new EnrichmentPipeline(eventBus);
await pipeline.initialize();  // Must await before use
```
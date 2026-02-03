# Services Reference

## Contents
- Service Architecture
- Event Bus Integration
- Service Patterns
- Initialization Pattern
- Anti-Patterns

## Service Architecture

This codebase uses an **event-driven service layer** rather than traditional request-response services. Services communicate through the central EventEmitter in `src/events/event-bus.js`.

```
Route Handler → Event Bus → Service → Event Bus → WebSocket Broadcast
```

## Event Bus Integration

The event bus is a singleton EventEmitter:

```javascript
// src/events/event-bus.js
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
module.exports = eventBus;
```

Services listen for events and emit results:

```javascript
// Service listening pattern
const eventBus = require('./events/event-bus');

eventBus.on('parsed', (event) => {
  const enriched = this.enrich(event);
  eventBus.emit('enriched', enriched);
});
```

## Service Patterns

### Enrichment Pipeline Pattern

```javascript
// src/enrichment/enrichment-pipeline.js
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.geoLocator = new CachedGeoLocator();
  }

  async initialize() {
    await this.geoLocator.initialize();
    
    this.eventBus.on('parsed', (event) => {
      this.enrich(event);
    });
  }

  enrich(event) {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', { ...event, geo: geoData });
  }
}
```

### Wiring Services in app.js

```javascript
// Create service instances
const enrichmentPipeline = new EnrichmentPipeline(eventBus);

async function start() {
  // Initialize services before server starts
  await enrichmentPipeline.initialize();
  
  server.listen(3000);
}
```

## Initialization Pattern

Services requiring async setup use an `initialize()` method called at startup:

```javascript
async function start() {
  try {
    // 1. Initialize services first
    await enrichmentPipeline.initialize();
    
    // 2. Start HTTP server
    server.listen(3000, () => {
      console.log('HTTP server listening on port 3000');
    });
    
    // 3. Setup WebSocket (depends on server)
    const wss = setupWebSocketServer(server, sessionParser);
    
    // 4. Wire event broadcast
    wireEventBroadcast(wss);
    
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}
```

## Graceful Shutdown

Services implement `shutdown()` for cleanup:

```javascript
process.on('SIGINT', () => {
  server.close();
  enrichmentPipeline.shutdown();
  process.exit(0);
});
```

## WARNING: Synchronous Service Initialization

**The Problem:**

```javascript
// BAD - blocking initialization
const geoLocator = new GeoLocator();
geoLocator.initializeSync(); // Blocks event loop

app.listen(3000); // Server starts before services ready
```

**Why This Breaks:**
1. Blocks event loop during database load
2. Server may accept requests before services ready
3. Race conditions with early requests

**The Fix:**

```javascript
// GOOD - async initialization before server start
async function start() {
  await geoLocator.initialize();  // Complete before continuing
  server.listen(3000);            // Now safe
}
```

## WARNING: Direct Service Coupling

**The Problem:**

```javascript
// BAD - tight coupling between services
class EnrichmentPipeline {
  constructor() {
    this.broadcaster = new AttackBroadcaster(); // Direct dependency
  }
}
```

**Why This Breaks:**
1. Cannot test enrichment without broadcaster
2. Cannot swap implementations
3. Circular dependency risk

**The Fix:**

```javascript
// GOOD - loose coupling via event bus
class EnrichmentPipeline {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }
  
  enrich(event) {
    // Emit event - broadcaster listens separately
    this.eventBus.emit('enriched', enrichedEvent);
  }
}
```

See the **node** skill for EventEmitter patterns.
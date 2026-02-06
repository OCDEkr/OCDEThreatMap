# Services Reference

## Contents
- Service Architecture
- Middleware Stack
- Helmet CSP Configuration
- Event Bus Integration
- Startup and Shutdown
- Anti-Patterns

## Service Architecture

No traditional service layer. This codebase uses an **event-driven pipeline** where services communicate through a central EventEmitter, not request-response calls.

```
UDP Receiver → Event Bus (message) → Parser → Event Bus (parsed) → Enrichment → Event Bus (enriched) → WebSocket Broadcast
```

Express routes exist only for auth, settings, and static files — they do NOT interact with the event pipeline. See the **node** skill for EventEmitter patterns.

## Middleware Stack

Applied in `src/app.js` in this exact order:

```javascript
// 1. Security headers (MUST be first)
app.use(helmet({ contentSecurityPolicy: { directives: { /* ... */ } } }));

// 2. Body parsing
app.use(bodyParser.json());

// 3. Session (after body parsing, before routes)
app.use(sessionParser);

// 4. General API rate limiting
app.use('/api', apiLimiter);

// 5. Static file serving
app.use(express.static('public'));

// 6. Route mounts with per-route middleware
app.use('/login', loginLimiter, loginRouter);
app.use('/api/change-password', passwordChangeLimiter, requireAuth, changePasswordRouter);
```

### WARNING: Middleware Order Violations

```javascript
// BAD — session after routes means req.session is undefined in handlers
app.use('/login', loginRouter);
app.use(sessionParser);

// BAD — static after routes means route handlers run for static file requests
app.use('/api', apiRouter);
app.use(express.static('public'));
```

## Helmet CSP Configuration

Custom Content Security Policy in `src/app.js:46-61` allows CDN-loaded Globe.GL, Three.js, and D3:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "unpkg.com", "raw.githubusercontent.com"],
      connectSrc: ["'self'", "ws:", "wss:", "raw.githubusercontent.com", "cdn.jsdelivr.net", "unpkg.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
```

**When adding a new CDN dependency:**
1. Add the domain to `scriptSrc` for JS files
2. Add to `connectSrc` if fetching data at runtime (TopoJSON, GeoJSON)
3. Add to `imgSrc` if loading images
4. `crossOriginEmbedderPolicy: false` is required for external resources

### WARNING: CSP Blocks New CDN Resources

**When You'll Hit This:** Adding a new visualization library from a CDN. The browser console shows `Refused to load the script` errors.

**The Fix:** Add the CDN domain to the relevant CSP directive. NEVER set `contentSecurityPolicy: false` — it disables all CSP protection.

## Event Bus Integration

The event bus is a singleton in `src/events/event-bus.js`. Services subscribe in their constructors or `initialize()` methods:

```javascript
// src/enrichment/enrichment-pipeline.js
class EnrichmentPipeline {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  async initialize() {
    await this.geoLocator.initialize();
    this.eventBus.on('parsed', (event) => this.enrich(event));
  }

  enrich(event) {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', { ...event, geo: geoData });
  }
}
```

## Startup and Shutdown

### Async Startup Sequence

Services must initialize before the HTTP server starts accepting connections:

```javascript
async function start() {
  try {
    // 1. Initialize services (MaxMind DB, etc.)
    await enrichmentPipeline.initialize();

    // 2. Start HTTP server
    server.listen(httpPort, httpBindAddress, () => {
      console.log(`HTTP server listening on ${httpBindAddress}:${httpPort}`);
    });

    // 3. Setup WebSocket (depends on HTTP server)
    const wss = setupWebSocketServer(server, sessionParser);

    // 4. Wire event broadcast (depends on WSS)
    wireEventBroadcast(wss);

    // 5. Start UDP receiver (last — begins accepting traffic)
    await receiver.listen();
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}
```

### Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  console.log(`Final: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}`);
  server.close(() => console.log('HTTP server closed'));
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});
```

## WARNING: Synchronous Service Initialization

**The Problem:**

```javascript
// BAD — server accepts requests before MaxMind DB is loaded
const geoLocator = new GeoLocator();
geoLocator.initializeSync();
app.listen(3000);
```

**Why This Breaks:**
1. Blocks event loop during multi-MB database load
2. Server may accept requests before geo lookups work
3. WebSocket clients connect before enrichment pipeline is ready

**The Fix:** Use the async `start()` pattern — `await initialize()` before `server.listen()`.

## WARNING: Direct Service Coupling

**The Problem:**

```javascript
// BAD — enrichment directly calls broadcaster
class EnrichmentPipeline {
  constructor() {
    this.broadcaster = new AttackBroadcaster();
  }
}
```

**Why This Breaks:**
1. Cannot test enrichment without broadcaster
2. Circular dependency risk
3. Cannot add new consumers without modifying enrichment

**The Fix:** Loose coupling via event bus — enrichment emits `enriched`, broadcaster listens independently. See the **node** skill for EventEmitter patterns.

## Settings as In-Memory State

`src/routes/settings.js` exports both a router and a `getSettings()` function consumed by `src/app.js`:

```javascript
const { getSettings } = require('./routes/settings');
const networkSettings = getSettings();
const httpPort = parseInt(process.env.HTTP_PORT || networkSettings.httpPort || '3000', 10);
```

Settings persist only until server restart. Environment variables always override in-memory settings.

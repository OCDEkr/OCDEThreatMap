# WebSocket Patterns Reference

## Contents
- Server Setup Patterns
- Dual Authentication Model
- Heartbeat Pattern
- Batched Broadcasting
- Event Bus Integration
- Client Reconnection
- Anti-Patterns

## Server Setup Patterns

### noServer Mode with Session Auth

Use `noServer: true` when you need to parse sessions before completing the upgrade. The `ws` library's built-in server mode skips the upgrade event entirely, making async authentication impossible.

```javascript
// src/websocket/ws-server.js
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true  // Required — enables wss.clients Set for broadcast loops
});

httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = session ? session.userId : 'anonymous-' + Date.now();
        ws.isAuthenticated = !!session;
        wss.emit('connection', ws, request);
      });
    });
});
```

**Why `clientTracking: true`:** Without it, `wss.clients` is undefined and every broadcast loop silently does nothing. The `ws` library defaults this to `true` when using its built-in server, but to `false` in noServer mode.

### Connection Event Setup

Every connection needs three things: heartbeat tracking, close handler, and error handler.

```javascript
// src/websocket/ws-server.js
wss.on('connection', (ws, request) => {
  ws.isAlive = true;
  ws.on('pong', heartbeatHandler);  // heartbeatHandler uses `this` binding

  ws.on('close', () => {
    ws.isAlive = false;
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    ws.isAlive = false;
    ws.terminate();  // NEVER close() on error — terminate immediately
  });
});
```

## Dual Authentication Model

This project supports **both anonymous and authenticated** WebSocket connections. The dashboard is public (NOC display use case); admin features require a session. See the **express-session** skill for session middleware configuration.

```javascript
// src/websocket/auth-handler.js — Public access (dashboard)
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve) => {
    sessionParser(request, {}, () => {
      if (request.session && request.session.authenticated === true) {
        resolve(request.session);  // Authenticated user
      } else {
        resolve(null);  // Anonymous — allowed for dashboard
      }
    });
  });
}

// Admin-only variant — rejects unauthenticated connections
function requireAuthUpgrade(request, socket, sessionParser) {
  return new Promise((resolve, reject) => {
    sessionParser(request, {}, () => {
      if (request.session && request.session.authenticated === true) {
        resolve(request.session);
      } else {
        reject(new Error('Not authenticated'));
      }
    });
  });
}
```

**Key:** `authenticateUpgrade` NEVER rejects. It resolves `null` for anonymous users. Use `requireAuthUpgrade` only for admin-only WebSocket endpoints that don't exist yet but are available if needed.

## Heartbeat Pattern

Detects dead connections via ping/pong. Critical for NOC displays running 24/7 where network drops go unnoticed.

```javascript
// src/websocket/heartbeat.js
const HEARTBEAT_INTERVAL = 30000;  // 30 seconds

function startHeartbeat(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;  // Mark dead until pong proves otherwise
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(interval));
}

// `this` is bound to the ws instance via ws.on('pong', heartbeatHandler)
function heartbeatHandler() {
  this.isAlive = true;
}
```

**Why 30s:** Balances detection speed vs overhead. Dead NOC connections cause stale visualizations. 30s detects within one missed cycle (60s worst case). Shorter intervals waste bandwidth on healthy connections.

## Batched Broadcasting

High-volume syslog traffic produces hundreds of events/second. Individual `send()` calls per event create excessive serialization and syscall overhead.

```javascript
// src/websocket/attack-broadcaster.js
const BATCH_INTERVAL_MS = 100;
const MAX_BATCH_SIZE = 50;

function flushBatch() {
  if (!wssRef || eventBatch.length === 0) return;

  const message = {
    type: 'batch',
    count: eventBatch.length,
    events: eventBatch
  };
  const messageStr = JSON.stringify(message);  // Stringify ONCE

  for (const client of wssRef.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (err) {
        client.terminate();  // Dead connection — kill it
      }
    }
  }
  eventBatch = [];
}
```

**Client must handle `type: 'batch'`:**

```javascript
// public/js/dashboard-client.js
if (data.type === 'batch' && Array.isArray(data.events)) {
  data.events.forEach(evt => processEvent(evt));
  return;
}
```

## Event Bus Integration

The broadcaster bridges the event bus and WebSocket clients. See the **node** skill for EventEmitter patterns.

```javascript
// src/websocket/broadcaster.js
function wireEventBroadcast(webSocketServer) {
  wss = webSocketServer;
  eventBus.on('enriched', (event) => {
    broadcastAttack(wss, event);
  });
}
```

The `enriched` event is emitted by `EnrichmentPipeline` after geolocation lookup. The broadcaster formats the event and queues it for batched delivery.

## Client Reconnection

Dashboard uses `ReconnectingWebSocket` with fallback to manual reconnect if the library fails to load.

```javascript
// public/js/dashboard-client.js
if (typeof ReconnectingWebSocket !== 'undefined') {
  ws = new ReconnectingWebSocket(wsUrl, [], { /* config */ });
} else {
  ws = new WebSocket(wsUrl);
  ws.addEventListener('close', () => setTimeout(connect, 3000));
}
```

The library is served from `node_modules` via Express static route in `src/app.js`. See the **express** skill for that route.

## Anti-Patterns

### WARNING: Unguarded send() in Broadcast Loops

**The Problem:**

```javascript
// BAD — One broken client crashes the entire broadcast
wss.clients.forEach(client => {
  client.send(JSON.stringify(data));
});
```

**Why This Breaks:**
1. `send()` throws if `readyState` is not OPEN
2. One broken client prevents all subsequent clients from receiving data
3. Dead connections accumulate without cleanup

**The Fix:**

```javascript
// GOOD — Check readyState, catch errors, terminate broken connections
for (const client of wss.clients) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      client.send(messageStr);
    } catch (err) {
      client.terminate();
    }
  }
}
```

### WARNING: Stringifying Per Client

```javascript
// BAD — N serializations for N clients
for (const client of wss.clients) {
  client.send(JSON.stringify(data));
}

// GOOD — Stringify once, send the same string to all
const messageStr = JSON.stringify(data);
for (const client of wss.clients) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(messageStr);
  }
}
```

**When You Might Be Tempted:** When each client needs slightly different data (e.g., filtered by auth level). In this project, all clients receive the same batch — no per-client filtering on the server side.

### WARNING: Using close() for Dead Connections

```javascript
// BAD — Sends close frame and waits for ack from dead client (hangs)
ws.close();

// GOOD — Immediately destroys the underlying socket
ws.terminate();
```

**Why This Breaks:** `close()` initiates a graceful close handshake. Dead connections never respond, so the socket lingers in CLOSING state indefinitely, leaking file descriptors.

### WARNING: Hardcoded WebSocket URLs

```javascript
// BAD — Breaks behind HTTPS reverse proxy
const ws = new WebSocket('ws://localhost:3000');

// GOOD — Auto-detect protocol and host
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${location.host}`);
```

**Why This Breaks:** Production deployments use HTTPS with TLS termination at a reverse proxy. Browsers block mixed content (HTTPS page connecting to `ws://`).

# WebSocket Patterns Reference

## Contents
- Server Setup Patterns
- Heartbeat Pattern
- Broadcasting Patterns
- Client Reconnection
- Error Handling
- Anti-Patterns

## Server Setup Patterns

### noServer Mode for Authentication

Use `noServer: true` when you need to authenticate before completing the WebSocket upgrade.

```javascript
// src/websocket/ws-server.js pattern
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true
});

httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = session.userId;  // Attach user info
        wss.emit('connection', ws, request);
      });
    })
    .catch((err) => {
      console.log('WebSocket auth failed:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
});
```

**Why noServer:** The `ws` library's built-in server mode doesn't support async authentication during upgrade. noServer mode gives you full control over when `handleUpgrade` is called.

### Connection Event Handling

```javascript
wss.on('connection', (ws, request) => {
  ws.isAlive = true;
  ws.on('pong', function() { this.isAlive = true; });

  ws.on('close', () => {
    ws.isAlive = false;
    console.log('Client disconnected:', ws.userId);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    ws.isAlive = false;
    ws.terminate();  // Force kill on error
  });
});
```

## Heartbeat Pattern

Detect dead connections with ping/pong frames. Critical for NOC displays that run continuously.

```javascript
// src/websocket/heartbeat.js
const HEARTBEAT_INTERVAL = 30000;  // 30 seconds

function startHeartbeat(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('Terminating dead connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(interval));
}

// Bind to each connection
function heartbeatHandler() {
  this.isAlive = true;
}
```

**Why 30 seconds:** Balances responsiveness (detecting dead connections quickly) with overhead (ping frames add traffic). For NOC displays, dead connections cause stale visualizations.

## Broadcasting Patterns

### Safe Broadcast with State Check

```javascript
// src/websocket/attack-broadcaster.js pattern
function broadcastAttack(wss, event) {
  const message = {
    type: 'enriched',
    timestamp: event.timestamp || new Date().toISOString(),
    geo: event.geo ? { ...event.geo, country_code: event.geo.country } : null,
    sourceIP: event.sourceIP,
    destinationIP: event.destinationIP,
    threatType: event.threatType
  };

  const messageStr = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error('Send failed:', err.message);
        client.terminate();
      }
    }
  }
}
```

**Key points:**
1. Check `readyState === WebSocket.OPEN` before every send
2. Stringify once, send many times
3. `terminate()` broken connections immediately
4. Never let a bad client crash the broadcast loop

### Event Bus Integration

```javascript
// src/websocket/broadcaster.js pattern
function wireEventBroadcast(webSocketServer) {
  const eventBus = require('../events/event-bus');
  
  eventBus.on('enriched', (event) => {
    broadcastAttack(webSocketServer, event);
  });
}
```

## Client Reconnection

### ReconnectingWebSocket Configuration

```javascript
// public/js/dashboard-client.js pattern
const ws = new ReconnectingWebSocket(wsUrl, [], {
  connectionTimeout: 5000,      // Give up connecting after 5s
  maxRetries: Infinity,         // Never stop trying
  maxReconnectionDelay: 30000,  // Cap backoff at 30s
  minReconnectionDelay: 500,    // Start at 500ms
  reconnectionDelayGrowFactor: 1.5,  // Exponential backoff
  minUptime: 5000               // Consider connected after 5s uptime
});
```

### Protocol Detection

```javascript
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${location.host}`;
```

## Error Handling

### WARNING: Silent Send Failures

**The Problem:**

```javascript
// BAD - No error handling
wss.clients.forEach(client => {
  client.send(JSON.stringify(data));
});
```

**Why This Breaks:**
1. `send()` throws if connection is closing
2. One bad client crashes entire broadcast loop
3. Dead connections accumulate, wasting memory

**The Fix:**

```javascript
// GOOD - Defensive send with cleanup
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

## Anti-Patterns

### WARNING: Missing readyState Check

```javascript
// BAD - Sends to CONNECTING, CLOSING, CLOSED clients
wss.clients.forEach(client => client.send(data));

// GOOD - Only send to OPEN clients
for (const client of wss.clients) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(data);
  }
}
```

### WARNING: Using close() for Dead Connections

```javascript
// BAD - close() waits for graceful shutdown
ws.close();

// GOOD - terminate() immediately destroys socket
ws.terminate();
```

**When to use each:**
- `close()`: User-initiated logout, graceful shutdown
- `terminate()`: Dead connection, error state, timeout
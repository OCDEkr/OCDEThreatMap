# WebSocket Workflows Reference

## Contents
- Server Setup Checklist
- Adding New Message Types
- Debugging Connections
- Testing WebSocket
- Graceful Shutdown
- Production Considerations

## Server Setup Checklist

Copy this checklist and track progress:
- [ ] Step 1: Create `WebSocketServer` with `noServer: true` and `clientTracking: true`
- [ ] Step 2: Wire `httpServer.on('upgrade')` to `authenticateUpgrade`
- [ ] Step 3: Call `wss.handleUpgrade` after auth, attach `userId` and `isAuthenticated` to `ws`
- [ ] Step 4: Set up `connection` event with `isAlive = true` and `pong` handler
- [ ] Step 5: Add `close` and `error` handlers on each connection
- [ ] Step 6: Start heartbeat via `startHeartbeat(wss)`
- [ ] Step 7: Wire event bus to broadcaster via `wireEventBroadcast(wss)`
- [ ] Step 8: Verify Helmet CSP includes `ws:` and `wss:` in `connectSrc` (see the **express** skill)

### Wiring Order in app.js

Order matters. The HTTP server must exist before WebSocket setup.

```javascript
// src/app.js — correct order
const server = http.createServer(app);                     // 1
const wss = setupWebSocketServer(server, sessionParser);   // 2
wireEventBroadcast(wss);                                   // 3
server.listen(httpPort, httpBindAddress);                   // 4
```

**WARNING:** If `server.listen()` runs before `setupWebSocketServer()`, the `upgrade` event handler is not registered. WebSocket connections fail silently with no error logs.

## Adding New Message Types

### Server Side

1. Define the format function in a broadcaster module:

```javascript
function formatStatusEvent(data) {
  return {
    type: 'status_update',
    timestamp: new Date().toISOString(),
    status: data.status,
    detail: data.detail
  };
}
```

2. Wire to event bus or call directly from broadcaster:

```javascript
// Option A: Via event bus
eventBus.on('status_change', (data) => {
  const message = JSON.stringify(formatStatusEvent(data));
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(message); } catch (e) { client.terminate(); }
    }
  }
});
```

### Client Side

Add handler in `public/js/dashboard-client.js` message listener:

```javascript
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'batch' && Array.isArray(data.events)) {
    data.events.forEach(evt => processEvent(evt));
    return;
  }
  // New message type
  if (data.type === 'status_update') {
    handleStatusUpdate(data);
    return;
  }
});
```

### Validation Loop

1. Add server-side format function and event wiring
2. Add client-side handler in `dashboard-client.js`
3. Test: trigger the event and check browser console
4. If message not received, check: `readyState`, CSP headers, `wss.clients.size`
5. Repeat until messages flow end-to-end

## Debugging Connections

### Browser Console Commands

```javascript
// Connection state (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
window.dashboardClient.getWebSocket().readyState

// Total events received
window.dashboardClient.getEventCount()

// OCDE filter state
window.dashboardClient.getFilterState()

// Monitor raw messages
const ws = window.dashboardClient.getWebSocket();
ws.addEventListener('message', e => console.log('RAW:', JSON.parse(e.data)));
```

### Server-Side Debug

```javascript
// Check connected client count
wss.clients.size

// Log per-connection details
wss.on('connection', (ws) => {
  console.log('[WS DEBUG]', {
    userId: ws.userId,
    authenticated: ws.isAuthenticated,
    totalClients: wss.clients.size
  });
});
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| No WebSocket connection | CSP blocks `ws:`/`wss:` | Add to Helmet `connectSrc`. See the **express** skill |
| Drops every 30s | Pong not reaching server | Verify `ws.on('pong', heartbeatHandler)` registered |
| Messages not received | `readyState` not OPEN | Check state before `send()` |
| Memory grows | Dead connections accumulate | Verify heartbeat is running and calling `terminate()` |
| Batch messages ignored | Client expects `type: 'enriched'` | Handle `type: 'batch'` with `data.events` array |
| 401 on upgrade | Session cookie not sent | Check `sameSite: 'lax'` in session config. See the **express-session** skill |
| Reconnect loop | Server not listening yet | Ensure `server.listen()` completes before clients connect |

## Testing WebSocket

### Manual Test with wscat

```bash
npm install -g wscat

# Anonymous connection (dashboard mode — should succeed)
wscat -c ws://localhost:3000

# Expect: connection opens, batch messages appear when traffic flows
```

### Send Test Attack Traffic

```bash
# Start server on dev port
SYSLOG_PORT=5514 node src/app.js &

# Send single test syslog message
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=8.8.8.8 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514
```

### High-Volume Test

```bash
node test/send-random-attacks.js
# Generates random UDP attack traffic — watch browser for arcs
```

### End-to-End Validation

1. Start server: `SYSLOG_PORT=5514 node src/app.js`
2. Open browser: `http://localhost:3000/dashboard`
3. Verify connection status shows "CONNECTED"
4. Send test traffic: `node test/send-random-attacks.js`
5. Verify arcs appear on globe/map
6. If arcs missing, check browser console for WebSocket errors
7. Repeat until visualization works end-to-end

## Graceful Shutdown

The attack broadcaster has `stopBatching()` that flushes pending events before exit.

```javascript
const { stopBatching } = require('./websocket/attack-broadcaster');

process.on('SIGINT', () => {
  stopBatching();  // Clears interval AND flushes pending batch
  server.close();
  process.exit(0);
});
```

**Key:** `stopBatching()` both clears the interval timer and flushes any pending events. Without this, events queued in the final 100ms window are silently dropped.

## Production Considerations

### Connection Limits

The `ws` library accepts unlimited connections. For a NOC display (2-5 clients), this is fine. For broader deployment:

```javascript
wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_CLIENTS) {
    ws.close(1013, 'Server overloaded');
    return;
  }
});
```

### Heartbeat Tuning

| Environment | Interval | Rationale |
|-------------|----------|-----------|
| NOC display (current) | 30s | Balance detection vs overhead |
| Mobile clients | 60s | Battery conservation |
| High-frequency trading | 10s | Fast dead connection detection |

### Security Checklist

Copy this checklist and track progress:
- [ ] Session cookie has `httpOnly: true` and `sameSite: 'lax'`
- [ ] Use `wss://` in production (TLS at reverse proxy)
- [ ] CSP `connectSrc` includes both `ws:` and `wss:`
- [ ] Validate incoming WebSocket message structure (if bidirectional)
- [ ] Log authentication failures with client IP
- [ ] Clients are receive-only — no inbound message processing needed

### WARNING: No Per-Client Rate Limiting

**Detected:** No rate limiting on incoming WebSocket messages.

**Impact:** Currently low risk because clients are receive-only (server broadcasts to clients, clients don't send data back). If bidirectional messaging is added:

```javascript
ws.on('message', (msg) => {
  ws.messageCount = (ws.messageCount || 0) + 1;
  if (ws.messageCount > MAX_MESSAGES_PER_SECOND) {
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
  // Process message
});
```

**When You Might Be Tempted to Skip:** When the first bidirectional feature is "just a simple ping." Even simple endpoints need rate limiting to prevent abuse.

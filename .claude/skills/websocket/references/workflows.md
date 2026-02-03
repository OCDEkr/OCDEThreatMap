# WebSocket Workflows Reference

## Contents
- Server Setup Checklist
- Adding New Message Types
- Debugging Connections
- Testing WebSocket Server
- Production Considerations

## Server Setup Checklist

Copy this checklist and track progress:
- [ ] Create WebSocketServer with `noServer: true` and `clientTracking: true`
- [ ] Wire HTTP upgrade event to authentication handler
- [ ] Implement session-based authentication in upgrade handler
- [ ] Attach user info to ws object after successful auth
- [ ] Set up connection event with isAlive tracking
- [ ] Add pong handler for heartbeat
- [ ] Add close and error handlers
- [ ] Start heartbeat interval
- [ ] Wire event bus to broadcaster
- [ ] Clean up interval on server close

### Wiring Order in app.js

```javascript
// 1. Create HTTP server
const server = http.createServer(app);

// 2. Setup WebSocket with session auth
const wss = setupWebSocketServer(server, sessionParser);

// 3. Wire event broadcast
wireEventBroadcast(wss);

// 4. Start HTTP server AFTER WebSocket setup
server.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
});
```

## Adding New Message Types

### Server Side

1. Define message structure in broadcaster:

```javascript
const message = {
  type: 'new_event_type',  // Unique type identifier
  timestamp: new Date().toISOString(),
  // ... event-specific fields
};
```

2. Wire to event bus:

```javascript
eventBus.on('new_event', (event) => {
  broadcast(wss, formatNewEvent(event));
});
```

### Client Side

1. Add handler in message listener:

```javascript
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'enriched':
      handleEnrichedEvent(data);
      break;
    case 'new_event_type':
      handleNewEvent(data);
      break;
  }
});
```

### Validation Loop

1. Add message type to server broadcaster
2. Add client handler
3. Test: `console.log` both sides
4. If message not received, check readyState and auth
5. Repeat until messages flow correctly

## Debugging Connections

### Check Connection State

```javascript
// In browser console
window.dashboardClient.getWebSocket().readyState
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
```

### Server-Side Debug Logging

```javascript
wss.on('connection', (ws, request) => {
  console.log('Client connected:', {
    userId: ws.userId,
    ip: request.socket.remoteAddress,
    totalClients: wss.clients.size
  });
});
```

### Broadcast Debug

```javascript
function broadcastAttack(wss, event) {
  let successCount = 0;
  let failureCount = 0;
  
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        successCount++;
      } catch (err) {
        failureCount++;
        client.terminate();
      }
    }
  }
  
  console.log(`Broadcast: ${successCount} ok, ${failureCount} failed`);
}
```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 on upgrade | Session not parsed | Check sessionParser middleware |
| Connection drops | No heartbeat | Implement ping/pong |
| Messages not received | Wrong readyState | Check OPEN before send |
| Memory leak | Dead connections | Implement heartbeat + terminate |

## Testing WebSocket Server

### Manual Test with wscat

```bash
# Install wscat
npm install -g wscat

# Connect (requires session cookie - manual auth first)
wscat -c ws://localhost:3000

# You'll get 401 without auth - normal behavior
```

### Send Test Messages

```bash
# In another terminal, send UDP syslog message
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=192.168.1.100 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514
```

### Browser Console Testing

```javascript
// Check connection
window.dashboardClient.getWebSocket()

// Check event count
window.dashboardClient.getEventCount()

// Monitor messages
const ws = window.dashboardClient.getWebSocket();
ws.addEventListener('message', e => console.log('MSG:', JSON.parse(e.data)));
```

## Production Considerations

### Connection Limits

The `ws` library doesn't limit connections by default. For NOC displays with few clients, this is fine. For public-facing apps, add limits:

```javascript
wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_CLIENTS) {
    ws.close(1013, 'Server overloaded');
    return;
  }
  // ... normal handling
});
```

### Heartbeat Tuning

| Environment | Interval | Rationale |
|-------------|----------|-----------|
| NOC display | 30s | Balance detection speed vs overhead |
| Mobile app | 60s | Battery considerations |
| High-frequency | 10s | Fast dead connection detection |

### Graceful Shutdown

```javascript
process.on('SIGTERM', () => {
  // Close WebSocket server (stops accepting new connections)
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Give clients time to receive close frame
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
```

### Security Checklist

- [ ] WebSocket upgrade requires valid session
- [ ] Session cookie has `httpOnly: true`
- [ ] Use `wss://` in production (TLS)
- [ ] Validate all incoming message structure
- [ ] Rate limit message processing per client
- [ ] Log authentication failures
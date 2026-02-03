---
name: websocket
description: |
  Implements WebSocket connections, authentication, and real-time communication.
  Use when: setting up WebSocket server, handling client connections, implementing broadcast patterns, or adding reconnection logic
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# WebSocket Skill

This codebase uses the `ws` library (v8.x) for server-side WebSocket handling and `reconnecting-websocket` for browser clients. The architecture follows a session-authenticated upgrade pattern with ping/pong heartbeats and event-driven broadcasting via EventEmitter.

## Quick Start

### Server Setup (noServer Mode)

```javascript
const { WebSocketServer, WebSocket } = require('ws');

// noServer mode = manual upgrade handling for auth
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true  // Enables wss.clients Set
});

httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = session.userId;
        wss.emit('connection', ws, request);
      });
    })
    .catch((err) => {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
});
```

### Client with Auto-Reconnect

```javascript
const ws = new ReconnectingWebSocket(wsUrl, [], {
  connectionTimeout: 5000,
  maxRetries: Infinity,
  maxReconnectionDelay: 30000,
  minReconnectionDelay: 500,
  reconnectionDelayGrowFactor: 1.5
});

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'enriched') {
    window.addAttackArc(data);
  }
});
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| noServer mode | Manual upgrade for auth | `new WebSocketServer({ noServer: true })` |
| clientTracking | Enable `wss.clients` Set | `clientTracking: true` |
| readyState check | Only send to OPEN clients | `client.readyState === WebSocket.OPEN` |
| isAlive flag | Track heartbeat responses | `ws.isAlive = true; ws.on('pong', handler)` |
| terminate vs close | Force-kill vs graceful | `ws.terminate()` for dead connections |

## Common Patterns

### Broadcast to All Clients

```javascript
function broadcast(wss, data) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        client.terminate();  // Kill broken connection
      }
    }
  }
}
```

### Session-Based Authentication

```javascript
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve, reject) => {
    sessionParser(request, {}, () => {
      if (request.session?.authenticated === true) {
        resolve(request.session);
      } else {
        reject(new Error('Not authenticated'));
      }
    });
  });
}
```

## See Also

- [patterns](references/patterns.md) - Server patterns, heartbeat, error handling
- [workflows](references/workflows.md) - Setup checklist, debugging, testing

## Related Skills

- See the **express** skill for session middleware integration
- See the **express-session** skill for session configuration
- See the **node** skill for EventEmitter patterns used in event bus
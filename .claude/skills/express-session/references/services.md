# Services Reference

## Contents
- Session Parser as Shared Service
- WebSocket Session Integration
- Service Wiring Pattern
- WARNING: Service Anti-Patterns

## Session Parser as Shared Service

The session parser is created once and shared across HTTP and WebSocket contexts.

```javascript
// src/middleware/session.js - Single source of truth
const session = require('express-session');

const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'ocde-threat-map-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
});

module.exports = { sessionParser };
```

## WebSocket Session Integration

Pass the same session parser to WebSocket authentication for unified session handling.

```javascript
// src/app.js - Service wiring
const { sessionParser } = require('./middleware/session');
const { setupWebSocketServer } = require('./websocket/ws-server');

// HTTP gets session middleware
app.use(sessionParser);

// WebSocket gets same session parser for upgrade auth
const wss = setupWebSocketServer(server, sessionParser);
```

## Service Wiring Pattern

The WebSocket server receives the session parser via dependency injection.

```javascript
// src/websocket/ws-server.js
function setupWebSocketServer(httpServer, sessionParser) {
  const wss = new WebSocketServer({ noServer: true });
  
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
  
  return wss;
}
```

## WARNING: Service Anti-Patterns

### Creating Multiple Session Instances

**The Problem:**

```javascript
// BAD - Two separate session instances
// file1.js
const sessionParser1 = session({ secret: 'key1' });

// file2.js  
const sessionParser2 = session({ secret: 'key2' });
```

**Why This Breaks:**
1. Different secrets = incompatible session cookies
2. User logged in via HTTP won't be authenticated on WebSocket
3. Debugging nightmare - auth works sometimes

**The Fix:**

```javascript
// GOOD - Single session module, exported once
// src/middleware/session.js
const sessionParser = session({ secret: process.env.SESSION_SECRET });
module.exports = { sessionParser };

// All consumers import the same instance
const { sessionParser } = require('./middleware/session');
```

### Hardcoded Secrets in Service Code

**The Problem:**

```javascript
// BAD - Secret embedded in code
const sessionParser = session({
  secret: 'my-hardcoded-secret-123'
});
```

**Why This Breaks:**
1. Secret gets committed to version control
2. Same secret across all environments
3. Cannot rotate without code change

**The Fix:**

```javascript
// GOOD - Environment variable with development fallback
const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-in-production'
});
```

### Session Store Memory Leaks

**The Problem:**

```javascript
// BAD - Default MemoryStore in production
// (No explicit store = MemoryStore)
const sessionParser = session({
  secret: process.env.SESSION_SECRET
});
```

**Why This Breaks:**
1. MemoryStore doesn't purge expired sessions
2. Memory grows unbounded over time
3. Sessions lost on server restart

**When You Might Be Tempted:**
- Quick development setup
- "It works locally" syndrome
- Forgetting to add production store config

**Production Fix:**
For this codebase (in-memory only, NOC display), MemoryStore is acceptable since the server rarely restarts and session count is limited. For production apps with many users, use Redis or connect-pg-simple.

## Related Services

See the **websocket** skill for WebSocket connection handling and session attachment.
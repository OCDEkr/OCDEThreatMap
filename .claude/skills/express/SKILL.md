---
name: express
description: |
  Configures Express 5.x routes, middleware, and HTTP server functionality for real-time syslog visualization.
  Use when: adding routes, creating middleware, configuring sessions, or integrating HTTP with WebSocket.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Express Skill

Express 5.x HTTP server powering dashboard authentication, static file serving, and WebSocket upgrade handling. This codebase uses session-based auth with `express-session`, minimal route structure (login/logout only), and serves primarily as a delivery mechanism for the real-time Globe.GL visualization.

## Quick Start

### Creating a Route

```javascript
// src/routes/my-route.js
const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  // Handle request
  res.json({ success: true });
});

module.exports = router;
```

### Mounting Routes

```javascript
// src/app.js
const myRouter = require('./routes/my-route');
app.use('/api/my-route', myRouter);
```

### Protected Route with Auth

```javascript
const { requireAuth } = require('./middleware/auth-check');

app.get('/protected', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'protected.html'));
});
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Router | Modular route handlers | `express.Router()` |
| Middleware | Request processing chain | `app.use(sessionParser)` |
| Static files | Serve public assets | `express.static('public')` |
| Session | Server-side auth state | `req.session.authenticated` |
| WebSocket upgrade | Share session with WS | `httpServer.on('upgrade', ...)` |

## Common Patterns

### Middleware Chain Order

**Order matters.** This is the correct sequence:

```javascript
app.use(bodyParser.json());      // 1. Parse body first
app.use(sessionParser);          // 2. Then session
app.use(express.static('public')); // 3. Static before routes
app.use('/api', apiRouter);      // 4. Routes last
```

### JSON API Response Pattern

```javascript
// Success
res.json({ success: true, data: result });

// Error with status
res.status(401).json({ success: false, error: 'Invalid credentials' });

// Server error
res.status(500).json({ error: 'Operation failed' });
```

### HTTP Server for WebSocket

```javascript
const http = require('http');
const app = express();
const server = http.createServer(app);

// Pass server to WebSocket setup
const wss = setupWebSocketServer(server, sessionParser);

server.listen(3000);
```

## See Also

- [routes](references/routes.md) - Route patterns and API endpoints
- [services](references/services.md) - Service layer integration
- [database](references/database.md) - Data persistence patterns
- [auth](references/auth.md) - Authentication and session handling
- [errors](references/errors.md) - Error handling strategies

## Related Skills

- **express-session** skill for detailed session configuration
- **websocket** skill for WebSocket server integration with Express
- **node** skill for EventEmitter patterns used throughout
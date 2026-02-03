---
name: express-session
description: |
  Implements session management and authentication middleware for Express 5.x.
  Use when: configuring session storage, adding route protection, handling login/logout flows, sharing sessions with WebSocket connections.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Express-session Skill

Server-side session management for the OCDE Threat Map dashboard authentication. Uses in-memory store (development default) with cookie-based session IDs. Sessions are shared between HTTP routes and WebSocket upgrade requests for unified authentication.

## Quick Start

### Session Configuration

```javascript
// src/middleware/session.js
const session = require('express-session');

const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'ocde-threat-map-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // Prevent XSS attacks
    secure: false,       // Set to true in production with HTTPS
    sameSite: 'strict',  // Prevent CSRF attacks
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
});

module.exports = { sessionParser };
```

### Apply Session Middleware

```javascript
// src/app.js
const { sessionParser } = require('./middleware/session');

app.use(bodyParser.json());
app.use(sessionParser);  // Must come before routes
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Session creation | Set properties on `req.session` | `req.session.authenticated = true` |
| Session destruction | Call `req.session.destroy()` | See logout route |
| Session sharing | Pass `sessionParser` to WebSocket | `authenticateUpgrade(req, socket, sessionParser)` |
| Route protection | Middleware checks `req.session` | `requireAuth` middleware |

## Common Patterns

### Creating Authenticated Session

**When:** User logs in successfully

```javascript
// src/routes/login.js
if (username === validUsername && password === validPassword) {
  req.session.userId = username;
  req.session.authenticated = true;
  res.json({ success: true });
}
```

### Protecting Routes

**When:** Restrict access to authenticated users

```javascript
// src/middleware/auth-check.js
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

// Usage in routes
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile('dashboard.html');
});
```

### WebSocket Session Sharing

**When:** Authenticate WebSocket connections using HTTP session

```javascript
// src/websocket/auth-handler.js
function authenticateUpgrade(request, socket, sessionParser) {
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

## See Also

- [routes](references/routes.md) - Login/logout route patterns
- [auth](references/auth.md) - Authentication middleware details
- [errors](references/errors.md) - Session error handling
- [services](references/services.md) - Session service patterns

## Related Skills

- See the **express** skill for route configuration and middleware ordering
- See the **websocket** skill for WebSocket session authentication
- See the **node** skill for environment variable configuration
# Authentication Reference

## Contents
- Auth Architecture
- Session Configuration
- Auth Middleware
- WebSocket Auth
- Anti-Patterns

## Auth Architecture

Simple session-based authentication:

```
Login Form → POST /login → Validate → Set session → Redirect to dashboard
Dashboard → requireAuth middleware → Check session → Serve or 401
WebSocket → Upgrade request → Parse session → Validate → Accept or reject
```

## Session Configuration

Session configured in `src/middleware/session.js`:

```javascript
const session = require('express-session');

const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'ocde-threat-map-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // Prevent XSS
    secure: false,       // Set true with HTTPS
    sameSite: 'strict',  // Prevent CSRF
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
});

module.exports = { sessionParser };
```

See the **express-session** skill for detailed configuration options.

## Auth Middleware

`src/middleware/auth-check.js`:

```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireAuth };
```

### Using Auth Middleware

```javascript
// Single route
app.get('/dashboard', requireAuth, (req, res) => { ... });

// Route group
app.use('/api', requireAuth, apiRouter);
```

## Login Flow

```javascript
// src/routes/login.js
router.post('/', (req, res) => {
  const { username, password } = req.body;
  
  const validUsername = process.env.DASHBOARD_USERNAME || 'admin';
  const validPassword = process.env.DASHBOARD_PASSWORD || 'change-me';
  
  if (username === validUsername && password === validPassword) {
    req.session.userId = username;
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});
```

## WebSocket Authentication

WebSocket upgrade shares session via `sessionParser`:

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

Usage in WebSocket server:

```javascript
// src/websocket/ws-server.js
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

See the **websocket** skill for WebSocket server patterns.

## WARNING: Hardcoded Credentials

**The Problem:**

```javascript
// BAD - credentials in code
const validUsername = 'admin';
const validPassword = 'password123';
```

**The Fix:**

```javascript
// GOOD - environment variables with fallback warning
const validUsername = process.env.DASHBOARD_USERNAME || 'admin';
const validPassword = process.env.DASHBOARD_PASSWORD;

if (!validPassword || validPassword === 'change-me') {
  console.warn('WARNING: Using default password. Set DASHBOARD_PASSWORD in production.');
}
```

## WARNING: Missing secure Cookie Flag

**The Problem:**

```javascript
cookie: {
  secure: false,  // Cookies sent over HTTP
}
```

**Why This Breaks:**
- Session cookie interceptable on network
- Man-in-the-middle attacks possible

**The Fix for Production:**

```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  // Or: secure: true, when behind HTTPS proxy
}
```

## Production Auth Checklist

Copy this checklist and track progress:
- [ ] Set strong `SESSION_SECRET` in environment
- [ ] Set `DASHBOARD_PASSWORD` (not default)
- [ ] Enable `cookie.secure = true` with HTTPS
- [ ] Consider rate limiting on `/login`
- [ ] Add session store (Redis) for multi-instance
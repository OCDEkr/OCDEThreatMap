# Authentication Reference

## Contents
- Authentication Middleware
- Session-Based Auth Flow
- WebSocket Authentication
- WARNING: Auth Anti-Patterns
- Auth Checklist

## Authentication Middleware

The `requireAuth` middleware gates access to protected routes.

```javascript
// src/middleware/auth-check.js
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireAuth };
```

## Session-Based Auth Flow

1. User submits credentials to `/login`
2. Server validates and sets `req.session.authenticated = true`
3. Cookie with session ID sent to browser
4. Subsequent requests include cookie automatically
5. `requireAuth` middleware checks session state

```javascript
// Login creates session
router.post('/', (req, res) => {
  const { username, password } = req.body;
  
  if (username === validUsername && password === validPassword) {
    req.session.userId = username;
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

## WebSocket Authentication

WebSocket connections authenticate during the HTTP upgrade handshake using the same session.

```javascript
// src/websocket/auth-handler.js
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve, reject) => {
    // Parse session from upgrade request cookies
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

```javascript
// src/websocket/ws-server.js - Using auth handler
httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.userId = session.userId;  // Attach user identity
        wss.emit('connection', ws, request);
      });
    })
    .catch((err) => {
      console.log('WebSocket authentication failed:', err.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
});
```

## WARNING: Auth Anti-Patterns

### Checking Only Truthy Values

**The Problem:**

```javascript
// BAD - Truthy check
if (req.session.authenticated) {
  next();
}
```

**Why This Breaks:**
1. Empty object `{}` is truthy
2. String `'false'` is truthy
3. Allows unintended access

**The Fix:**

```javascript
// GOOD - Strict equality
if (req.session && req.session.authenticated === true) {
  next();
}
```

### Missing Session Existence Check

**The Problem:**

```javascript
// BAD - No session existence check
if (req.session.authenticated === true) {
  next();
}
```

**Why This Breaks:**
1. `req.session` may be undefined if session middleware failed
2. Throws TypeError attempting to access `.authenticated`
3. Crashes the request handler

**The Fix:**

```javascript
// GOOD - Check session exists first
if (req.session && req.session.authenticated === true) {
  next();
}
```

### Exposing Internal Errors to Client

**The Problem:**

```javascript
// BAD - Detailed error message
res.status(401).json({ 
  error: 'User kriley not found in database table users'
});
```

**Why This Breaks:**
1. Reveals username exists/doesn't exist (user enumeration)
2. Exposes database schema information
3. Aids attackers in targeted attacks

**The Fix:**

```javascript
// GOOD - Generic message
res.status(401).json({ error: 'Invalid credentials' });
```

### Timing Attacks in Credential Check

**The Problem:**

```javascript
// BAD - Short-circuit evaluation
if (username !== validUsername) {
  return res.status(401).json({ error: 'Invalid' });
}
if (password !== validPassword) {
  return res.status(401).json({ error: 'Invalid' });
}
```

**Why This Breaks:**
1. Invalid username responds faster than invalid password
2. Timing difference reveals valid usernames
3. Enables username enumeration

**When You Might Be Tempted:**
- Early return for "efficiency"
- Separate error messages for debugging

**The Fix (for sensitive applications):**

```javascript
// GOOD - Constant-time comparison (for high-security apps)
const crypto = require('crypto');
const usernameMatch = crypto.timingSafeEqual(
  Buffer.from(username), Buffer.from(validUsername)
);
const passwordMatch = crypto.timingSafeEqual(
  Buffer.from(password), Buffer.from(validPassword)
);
if (usernameMatch && passwordMatch) {
  // Authenticated
}
```

Note: For this NOC dashboard with environment-variable credentials, the simple comparison is acceptable.

## Auth Implementation Checklist

Copy this checklist when implementing authentication:
- [ ] Session middleware applied before auth routes
- [ ] Strict equality check (`=== true`) for authenticated flag
- [ ] Null check on `req.session` before accessing properties
- [ ] Generic error messages (no user enumeration)
- [ ] Session destroyed on logout with callback handling
- [ ] WebSocket upgrade uses same session parser
- [ ] 401 response for unauthenticated requests

## Related Skills

See the **websocket** skill for WebSocket-specific authentication patterns.
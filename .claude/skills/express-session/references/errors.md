# Errors Reference

## Contents
- Session Error Types
- Error Handling Patterns
- WebSocket Auth Errors
- WARNING: Error Anti-Patterns

## Session Error Types

| Error | Cause | Handling |
|-------|-------|----------|
| Session undefined | Middleware not applied | Check middleware order |
| Destroy callback error | Store failure | Log and return 500 |
| Cookie parse failure | Malformed cookie | Session middleware handles |
| Store connection failure | Redis/DB down | Fallback or error response |

## Error Handling Patterns

### Session Destruction Errors

Always handle the destroy callback error.

```javascript
// src/routes/logout.js
router.post('/', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});
```

### Missing Session Handling

Guard against undefined session gracefully.

```javascript
// src/middleware/auth-check.js
function requireAuth(req, res, next) {
  // First check: does session exist?
  // Second check: is user authenticated?
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}
```

### Authentication Failure Responses

Return consistent error format for auth failures.

```javascript
// Consistent 401 response structure
res.status(401).json({
  success: false,
  error: 'Invalid credentials'
});

// Or simpler format
res.status(401).json({ error: 'Not authenticated' });
```

## WebSocket Auth Errors

Handle authentication failures during WebSocket upgrade.

```javascript
// src/websocket/ws-server.js
httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      // Success path
    })
    .catch((err) => {
      // Log for debugging (server-side only)
      console.log('WebSocket authentication failed:', err.message);
      
      // Return HTTP 401 to client
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
});
```

### WebSocket Error Events

```javascript
// src/websocket/ws-server.js
ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  ws.isAlive = false;
  ws.terminate();
});
```

## WARNING: Error Anti-Patterns

### Silent Session Destruction

**The Problem:**

```javascript
// BAD - Ignoring destroy errors
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
```

**Why This Breaks:**
1. `destroy()` is asynchronous
2. Response may send before destroy completes
3. Store errors are silently ignored
4. Session may remain active

**The Fix:**

```javascript
// GOOD - Handle callback
req.session.destroy((err) => {
  if (err) {
    return res.status(500).json({ error: 'Logout failed' });
  }
  res.json({ success: true });
});
```

### Exposing Stack Traces

**The Problem:**

```javascript
// BAD - Sending error details to client
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack
  });
});
```

**Why This Breaks:**
1. Reveals internal file paths
2. Exposes dependency versions
3. Aids attackers in finding vulnerabilities

**The Fix:**

```javascript
// GOOD - Generic error, log details server-side
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Crashing on Session Errors

**The Problem:**

```javascript
// BAD - Accessing session without null check
function requireAuth(req, res, next) {
  if (req.session.authenticated === true) {  // Throws if session undefined
    next();
  }
}
```

**Why This Breaks:**
1. `req.session` may be undefined
2. TypeError crashes the request
3. May crash entire process with uncaught exception

**The Fix:**

```javascript
// GOOD - Defensive null check
if (req.session && req.session.authenticated === true) {
  next();
}
```

### Not Logging Auth Failures

**The Problem:**

```javascript
// BAD - Silent auth rejection
.catch(() => {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  socket.destroy();
});
```

**Why This Breaks:**
1. No visibility into failed auth attempts
2. Cannot detect brute force attacks
3. Debugging auth issues is impossible

**The Fix:**

```javascript
// GOOD - Log failures (without sensitive data)
.catch((err) => {
  console.log('WebSocket authentication failed:', err.message);
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  socket.destroy();
});
```

## Error Response Consistency

Use consistent error response format across all routes:

```javascript
// Success responses
res.json({ success: true });
res.json({ success: true, data: { ... } });

// Error responses
res.status(401).json({ error: 'Not authenticated' });
res.status(401).json({ success: false, error: 'Invalid credentials' });
res.status(500).json({ error: 'Logout failed' });
```

## Error Handling Checklist

Copy this checklist for error handling review:
- [ ] Session destroy uses callback with error handling
- [ ] Session existence checked before property access
- [ ] Generic error messages to clients
- [ ] Detailed errors logged server-side only
- [ ] WebSocket auth failures logged
- [ ] Consistent error response format
- [ ] No stack traces in responses
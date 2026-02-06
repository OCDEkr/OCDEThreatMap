# Auth Reference

## Contents
- Authentication Model
- Login Flow
- Route Protection
- WebSocket Authentication
- Session Properties
- Password Verification Modes
- Anti-Patterns

## Authentication Model

Single-admin authentication. One username (from `DASHBOARD_USERNAME` env var, default `admin`) and one password (from `DASHBOARD_PASSWORD` env var or `data/password.hash` file). No user registration, no roles, no multi-user.

## Login Flow

1. Client sends POST /login with `{ username, password }`
2. Rate limiter checks IP (5 attempts / 15 min)
3. Username verified with constant-time comparison (`safeCompare`)
4. Password verified with bcrypt (if changed) or constant-time comparison (if initial)
5. On success: session properties set, 200 returned
6. On failure: generic "Invalid credentials" (prevents username enumeration)

```javascript
// src/routes/login.js — session creation
req.session.userId = username;
req.session.authenticated = true;
req.session.loginTime = Date.now();
req.session.ip = clientIP;
```

## Route Protection

### requireAuth Middleware

Applied to routes in two ways:

**1. In app.js middleware chain (preferred for entire route groups):**

```javascript
app.use('/api/change-password', passwordChangeLimiter, requireAuth, changePasswordRouter);
app.get('/admin', requireAuth, (req, res) => { /* ... */ });
```

**2. Inside route files (for mixed public/protected routes):**

```javascript
// src/routes/settings.js — GET is public, PUT requires auth
router.get('/', (req, res) => { /* public */ });
router.put('/', requireAuth, (req, res) => { /* protected */ });
```

### Content Negotiation in Auth Guard

The `requireAuth` middleware responds differently based on request type:

```javascript
// API requests get 401 JSON
if (isApiRequest) {
  res.status(401).json({ error: 'Not authenticated' });
}
// Browser requests get redirected to login
else {
  res.redirect('/login');
}
```

Detection logic: path starts with `/api`, Accept header includes `application/json`, or `req.xhr` is true.

## WebSocket Authentication

WebSocket connections use the same session cookies as HTTP. The `sessionParser` is invoked manually during the HTTP upgrade. See the **websocket** skill for full connection lifecycle.

### Public Dashboard Access (Anonymous)

```javascript
// src/websocket/auth-handler.js — allows unauthenticated WS connections
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve) => {
    sessionParser(request, {}, () => {
      if (request.session?.authenticated === true) {
        resolve(request.session);  // Authenticated user
      } else {
        resolve(null);             // Anonymous — allowed for dashboard
      }
    });
  });
}
```

### Admin-Only WebSocket Access (Reject Anonymous)

```javascript
// src/websocket/auth-handler.js — for admin-only WS endpoints
function requireAuthUpgrade(request, socket, sessionParser) {
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

## Session Properties

| Property | Type | Set When | Purpose |
|----------|------|----------|---------|
| `authenticated` | `boolean` | Login success | Primary auth flag — always check `=== true` |
| `userId` | `string` | Login success | Username for logging |
| `loginTime` | `number` | Login success | Timestamp for session age tracking |
| `ip` | `string` | Login success | Client IP at login time |
| `passwordChangedAt` | `number` | Password change | Marks session as post-change |

## Password Verification Modes

Two modes based on whether admin has changed the default password:

| Mode | When | Method | Source |
|------|------|--------|--------|
| Plaintext | Initial (no `data/password.hash`) | `safeCompare` | `DASHBOARD_PASSWORD` env var |
| Hashed | After first password change | `bcrypt.compare` | `data/password.hash` file |

The `isPasswordHashed()` function determines which mode to use. Both login and change-password routes use this dispatch.

## WARNING: Auth Anti-Patterns

### Truthy Check Instead of Strict Equality

**The Problem:**

```javascript
// BAD — truthy check
if (req.session.authenticated) { next(); }
```

**Why This Breaks:** Any truthy value passes — a string, a number, an object. If session data is corrupted or manipulated, non-boolean truthy values could bypass auth.

**The Fix:**

```javascript
// GOOD — strict boolean check
if (req.session && req.session.authenticated === true) { next(); }
```

### Leaking Username Validity

**The Problem:**

```javascript
// BAD — different errors reveal which field is wrong
if (!usernameValid) res.json({ error: 'User not found' });
if (!passwordValid) res.json({ error: 'Wrong password' });
```

**Why This Breaks:** Attackers enumerate valid usernames by comparing error messages.

**The Fix:** Always return a generic message regardless of which field failed:

```javascript
// GOOD — generic error prevents enumeration
res.status(401).json({ success: false, error: 'Invalid credentials' });
```

### Adding New Auth Route Checklist

Copy this checklist and track progress:
- [ ] Add rate limiter appropriate to the endpoint sensitivity
- [ ] Apply `requireAuth` middleware (in app.js or route file)
- [ ] Log security events via `logSecurityEvent()`
- [ ] Return generic error messages (no internal details)
- [ ] Use `getClientIP(req)` for IP logging (handles x-forwarded-for)
- [ ] Test with expired/missing session cookie

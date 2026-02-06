# Routes Reference

## Contents
- Auth Routes (Login, Logout)
- Protected Route Mounting
- Public vs Protected Route Pattern
- Rate Limiter Integration
- Anti-Patterns

## Auth Routes

### POST /login — Credential Verification

```javascript
// src/routes/login.js — mounted at app.use('/login', loginLimiter, loginRouter)
router.post('/', async (req, res) => {
  const { username, password } = req.body;
  const clientIP = getClientIP(req);

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const usernameValid = safeCompare(username, validUsername);
  let passwordValid = false;

  if (isPasswordHashed()) {
    passwordValid = await verifyPassword(password, getPasswordHash());
  } else {
    passwordValid = safeCompare(password, getCurrentPassword());
  }

  if (usernameValid && passwordValid) {
    req.session.userId = username;
    req.session.authenticated = true;
    req.session.loginTime = Date.now();
    req.session.ip = clientIP;
    logSecurityEvent('login_success', { username, ip: clientIP });
    res.json({ success: true });
  } else {
    logSecurityEvent('login_failed', { username, ip: clientIP });
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});
```

### POST /logout — Session Destruction

```javascript
// src/routes/logout.js — always clear the cookie by name
router.post('/', (req, res) => {
  const username = req.session?.userId || 'unknown';
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    logSecurityEvent('logout', { username, ip: getClientIP(req) });
    res.clearCookie('ocde.sid');  // Must match session name in session.js
    res.json({ success: true });
  });
});
```

## Protected Route Mounting

### Middleware Chains in app.js

```javascript
// src/app.js — each route has its own middleware stack
app.use('/login', loginLimiter, loginRouter);           // Rate limited, no auth
app.use('/logout', logoutRouter);                        // No auth (destroy is safe)
app.use('/api/change-password', passwordChangeLimiter, requireAuth, changePasswordRouter);
app.use('/api/settings', settingsRouter);                // GET public, PUT uses requireAuth internally
app.use('/api/logo', logoRouter);                        // GET public, POST/DELETE use requireAuth internally
app.get('/admin', requireAuth, (req, res) => {           // Inline guard
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
```

## Public vs Protected Route Pattern

This codebase uses a **hybrid access model**: dashboard is public (NOC display), admin functions require auth.

| Route | Auth | Rate Limit | Why |
|-------|------|------------|-----|
| GET /dashboard | No | No | NOC displays run unattended |
| GET /api/settings | No | API (100/min) | Dashboard reads heading text |
| PUT /api/settings | Yes | API (100/min) | Only admin changes config |
| GET /api/auth/status | No | API (100/min) | Client checks auth state |
| POST /login | No | Login (5/15min) | Must be reachable to authenticate |

### Auth Guard with Content Negotiation

```javascript
// src/middleware/auth-check.js — returns 401 for API, redirects for HTML
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    return next();
  }
  const isApiRequest = req.path.startsWith('/api') ||
    req.headers.accept?.includes('application/json') || req.xhr;
  isApiRequest
    ? res.status(401).json({ error: 'Not authenticated' })
    : res.redirect('/login');
}
```

## Rate Limiter Integration

Rate limiters from `src/middleware/rate-limiter.js` are applied per-route in app.js, not globally. See the **express** skill for Helmet and middleware ordering.

```javascript
// Three separate limiters with different windows
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });          // 5/15min
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });               // 100/min
const passwordChangeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 }); // 3/hr
```

## WARNING: Route Anti-Patterns

### Forgetting clearCookie on Logout

**The Problem:**

```javascript
// BAD — session destroyed but cookie lingers
req.session.destroy(() => {
  res.json({ success: true });
});
```

**Why This Breaks:** The browser keeps sending the old `ocde.sid` cookie. Express-session creates a new empty session for each request, wasting memory. The client may appear "half-logged-in" if any code checks cookie presence.

**The Fix:**

```javascript
// GOOD — destroy session AND clear cookie
req.session.destroy(() => {
  res.clearCookie('ocde.sid');
  res.json({ success: true });
});
```

### Using Default Cookie Name

**The Problem:**

```javascript
// BAD — exposes technology stack
const sessionParser = session({ secret: '...' });
// Creates cookie named 'connect.sid'
```

**Why This Breaks:** Automated scanners fingerprint `connect.sid` to identify Express/Node.js targets. Custom names like `ocde.sid` reduce attack surface visibility.

**The Fix:** Always set `name` in session config (already done in `src/middleware/session.js`).

### Adding New Route Checklist

Copy this checklist and track progress:
- [ ] Decide: public or protected? If protected, add `requireAuth`
- [ ] Choose rate limiter tier (login/API/password) or create new one
- [ ] Mount in app.js with correct middleware order: `limiter, auth, router`
- [ ] Use `{ success: boolean, error?: string }` response format
- [ ] Log security events via `logSecurityEvent()` if auth-related
- [ ] Test with expired/missing session cookie

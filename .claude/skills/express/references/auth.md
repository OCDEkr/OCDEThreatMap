# Authentication Reference

## Contents
- Auth Architecture
- Session Configuration
- Auth Middleware
- Login Flow (bcrypt + Constant-Time)
- Password Change Flow
- Rate Limiting
- WebSocket Auth
- Anti-Patterns

## Auth Architecture

Session-based auth with bcrypt password hashing. Dashboard is public (NOC display). Admin panel requires login.

```
Login Form → POST /login → bcrypt verify or safeCompare → Set session → Redirect
Admin Route → requireAuth → Check req.session.authenticated → Serve or reject
WebSocket → HTTP upgrade → Parse session → Accept (anonymous allowed for dashboard)
```

## Session Configuration

Configured in `src/middleware/session.js`. See the **express-session** skill for detailed options.

```javascript
const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'ocde-threat-map-change-in-production',
  name: 'ocde.sid',            // Custom name (not default 'connect.sid')
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,            // JS cannot access cookie
    secure: isProduction,      // HTTPS only in production
    sameSite: 'lax',           // Allows WebSocket upgrades, prevents most CSRF
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
});
```

**Critical:** `sameSite` is `'lax'` (not `'strict'`) because `'strict'` blocks the session cookie on WebSocket upgrade requests from the same page.

## Auth Middleware

`src/middleware/auth-check.js` — content-type aware rejection:

```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    const isApiRequest = req.path.startsWith('/api') ||
                         req.headers.accept?.includes('application/json') ||
                         req.xhr;
    if (isApiRequest) {
      res.status(401).json({ error: 'Not authenticated' });
    } else {
      res.redirect('/login');
    }
  }
}
```

## Login Flow (src/routes/login.js)

Dual verification: bcrypt for hashed passwords (after first change), constant-time compare for initial env-based password.

```javascript
router.post('/', async (req, res) => {
  const { username, password } = req.body;
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
    req.session.ip = getClientIP(req);
    logSecurityEvent('login_success', { username, ip: clientIP });
    res.json({ success: true });
  } else {
    logSecurityEvent('login_failed', { username, ip: clientIP });
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});
```

**Key security patterns:**
- Generic "Invalid credentials" error prevents username enumeration
- `safeCompare` uses `crypto.timingSafeEqual` to prevent timing attacks
- Both username AND password checked before responding (prevents early-exit timing leaks)

## Password Change Flow (src/routes/change-password.js)

Validates current password, enforces complexity, hashes with bcrypt (12 rounds), persists to `data/password.hash`:

```javascript
// Complexity requirements
if (newPassword.length < 8) { /* reject */ }
if (!hasLower || !hasUpper || !hasNumber) { /* reject */ }

// Hash and persist
const newHash = await hashPassword(newPassword);
savePasswordHash(newHash);  // fs.writeFileSync with mode 0o600
passwordHash = newHash;     // Update in-memory

// Regenerate session to invalidate other sessions
req.session.regenerate((err) => {
  req.session.userId = userId;
  req.session.authenticated = true;
  req.session.passwordChangedAt = Date.now();
});
```

## Rate Limiting

Three rate limiters in `src/middleware/rate-limiter.js`:

| Limiter | Window | Max | Endpoint |
|---------|--------|-----|----------|
| `loginLimiter` | 15 min | 5 | `POST /login` |
| `apiLimiter` | 1 min | 100 | `/api/*` |
| `passwordChangeLimiter` | 1 hour | 3 | `POST /api/change-password` |

All use `getClientIP(req)` as key and log rate limit events via `logSecurityEvent`.

```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logSecurityEvent('rate_limited', { ip: getClientIP(req), endpoint: '/login' });
    res.status(429).json(options.message);
  },
  keyGenerator: (req) => getClientIP(req)
});
```

## WebSocket Auth

WebSocket upgrade shares `sessionParser` to parse session cookies. Dashboard connections are anonymous (public). See the **websocket** skill for details.

```javascript
// src/websocket/auth-handler.js
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve) => {
    sessionParser(request, {}, () => {
      if (request.session && request.session.authenticated === true) {
        resolve(request.session);
      } else {
        resolve(null);  // Anonymous access — NOT rejected
      }
    });
  });
}
```

## WARNING: Plain-Text Password Comparison Without Constant-Time

**The Problem:**

```javascript
// BAD — timing attack vulnerability
if (password === storedPassword) { /* ... */ }
```

**Why This Breaks:** String `===` short-circuits on first different byte. Attackers measure response times to guess password character-by-character.

**The Fix (already implemented):**

```javascript
function safeCompare(a, b) {
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, '\0');
  const paddedB = b.padEnd(maxLen, '\0');
  return crypto.timingSafeEqual(Buffer.from(paddedA), Buffer.from(paddedB));
}
```

## WARNING: Session Cookie Named 'connect.sid'

**The Problem:** Default `connect.sid` cookie name reveals Express + express-session to attackers.

**The Fix (already implemented):** Custom cookie name `ocde.sid` in session config.

## Production Auth Checklist

Copy this checklist and track progress:
- [ ] Set strong `SESSION_SECRET` (32+ hex chars): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Set `DASHBOARD_PASSWORD` (not default 'ChangeMe')
- [ ] Set `NODE_ENV=production` for `cookie.secure = true`
- [ ] Verify rate limiters active (check logs for `[SECURITY]` output)
- [ ] Confirm `data/password.hash` has `0o600` permissions
- [ ] Consider session store (Redis) if scaling beyond single instance

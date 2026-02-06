# Errors Reference

## Contents
- Error Response Format
- Session Error Handling
- Rate Limit Errors
- File Upload Errors
- Dead Letter Queue
- Anti-Patterns

## Error Response Format

All API errors follow a consistent JSON structure:

```javascript
// Standard error response shape
{ success: false, error: 'Human-readable message' }

// Standard success response shape
{ success: true, /* additional fields */ }
```

HTTP status codes used in auth routes:

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad request / validation failure | Missing username/password, weak password |
| 401 | Not authenticated | Invalid credentials, expired session |
| 404 | Not found | Unknown setting key, no custom logo |
| 429 | Rate limited | Too many login attempts |
| 500 | Server error | Session destruction failure, hash failure |

## Session Error Handling

### Session Destruction Failure

```javascript
// src/routes/logout.js — handle destroy callback error
req.session.destroy((err) => {
  if (err) {
    console.error('Session destruction error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
  res.clearCookie('ocde.sid');
  res.json({ success: true });
});
```

### Session Regeneration Failure

```javascript
// src/routes/change-password.js — regenerate is fire-and-forget
req.session.regenerate((err) => {
  if (!err) {
    req.session.userId = userId;
    req.session.authenticated = true;
    req.session.passwordChangedAt = Date.now();
  }
  // Error is logged implicitly — response already sent
});
```

The password change response is sent before regeneration completes. This is intentional — the password is already saved, and regeneration failure does not affect security (the old session remains valid with the new password).

### bcrypt Verification Failure

```javascript
// src/utils/security.js — never throw on bad hash
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.error('[Security] Password verification error:', err.message);
    return false;  // Treat corrupt hash as invalid password
  }
}
```

## Rate Limit Errors

Rate limiters return 429 with custom messages and log security events.

```javascript
// src/middleware/rate-limiter.js — custom handler for login limiter
handler: (req, res, next, options) => {
  logSecurityEvent('rate_limited', {
    ip: getClientIP(req),
    endpoint: '/login',
    username: req.body?.username || 'unknown'
  });
  res.status(429).json(options.message);
},
```

Three rate limit tiers:

| Limiter | Window | Max | Endpoint |
|---------|--------|-----|----------|
| `loginLimiter` | 15 min | 5 | POST /login |
| `apiLimiter` | 1 min | 100 | All /api/* routes |
| `passwordChangeLimiter` | 1 hour | 3 | POST /api/change-password |

## File Upload Errors

Logo upload uses Multer with a scoped error handler. See the **express** skill for Multer configuration.

```javascript
// src/routes/logo.js — Multer error middleware (must be on the router, not app)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});
```

## Dead Letter Queue

Failed syslog parse attempts go to DLQ — not auth errors. Auth errors are handled inline in route handlers. See the **syslog-parser** skill for parse error patterns.

```javascript
// src/utils/error-handler.js — DLQ for pipeline failures only
class DeadLetterQueue {
  add(rawMessage, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      rawMessage: rawMessage.substring(0, 500),
    };
    fs.appendFileSync(this.failedMessagesFile, JSON.stringify(entry) + '\n');
  }
}
```

Auth route errors are logged via `logSecurityEvent()`, not the DLQ. These are separate concerns:
- **DLQ**: Malformed syslog input (operational issue)
- **Security log**: Login failures, rate limits, password changes (security audit trail)

## WARNING: Error Anti-Patterns

### Exposing Internal Errors to Clients

**The Problem:**

```javascript
// BAD — leaks bcrypt version, hash format, file paths
catch (err) {
  res.status(500).json({ error: err.message, stack: err.stack });
}
```

**Why This Breaks:** Error messages from bcrypt, fs, and crypto contain implementation details attackers use for targeted exploits.

**The Fix:**

```javascript
// GOOD — generic message to client, full details to server log
catch (err) {
  console.error('[Password] Hash error:', err);
  res.status(500).json({ success: false, error: 'Failed to change password' });
}
```

### Silent Catch Without Logging

**The Problem:**

```javascript
// BAD — swallows errors completely
try { await verifyPassword(pw, hash); } catch (e) { return false; }
```

**Why This Breaks:** Corrupt password hashes, missing bcrypt native bindings, or memory issues become invisible. You lose the ability to diagnose auth failures.

**The Fix:** Always log before returning the fallback value:

```javascript
// GOOD — log the error, then return safe default
catch (err) {
  console.error('[Security] Password verification error:', err.message);
  return false;
}
```

### Error Handling Validation Checklist

Copy this checklist and track progress:
- [ ] Client receives generic error message (no internal details)
- [ ] Server logs full error with context prefix (e.g., `[Security]`, `[Password]`)
- [ ] HTTP status code matches error category (400/401/429/500)
- [ ] Response uses `{ success: false, error: '...' }` format
- [ ] Security-relevant errors call `logSecurityEvent()`

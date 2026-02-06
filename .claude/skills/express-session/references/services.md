# Services Reference

## Contents
- Password Service
- Settings Service
- Security Utilities
- WebSocket Session Sharing
- Anti-Patterns

## Password Service

Password management in `src/routes/change-password.js` combines routing with service logic. It manages a dual-mode password system: initial plaintext from env var, then bcrypt-hashed after first change.

### Password Lifecycle

```javascript
// src/routes/change-password.js — state machine
const PASSWORD_FILE = path.join(__dirname, '..', '..', 'data', 'password.hash');
let passwordHash = null; // null = use env var, non-null = use bcrypt

// On module load, try to read persisted hash
loadPasswordHash();

// Verification dispatches based on state
if (isPasswordHashed()) {
  passwordValid = await verifyPassword(currentPassword, passwordHash);
} else {
  passwordValid = safeCompare(currentPassword, getCurrentPassword());
}
```

### Password Change with Session Regeneration

```javascript
// After successful password change — prevent session fixation
const newHash = await hashPassword(newPassword);
savePasswordHash(newHash);  // Writes to data/password.hash with mode 0o600
passwordHash = newHash;

req.session.regenerate((err) => {
  if (!err) {
    req.session.userId = userId;
    req.session.authenticated = true;
    req.session.passwordChangedAt = Date.now();
  }
});
```

### Exported Helper Functions

```javascript
// Used by login route to determine verification strategy
module.exports.getCurrentPassword = getCurrentPassword;  // Returns env var or 'ChangeMe'
module.exports.getPasswordHash = getPasswordHash;         // Returns bcrypt hash or null
module.exports.isPasswordHashed = isPasswordHashed;       // Boolean: has password been changed?
```

## Settings Service

In-memory key-value store in `src/routes/settings.js`. No persistence — resets on restart.

```javascript
// src/routes/settings.js — in-memory defaults
const settings = {
  heading: 'OCDE Threat Map',
  httpBindAddress: '127.0.0.1',
  syslogBindAddress: '127.0.0.1',
  httpPort: 3000,
  syslogPort: 514,
};

// Exported for use by app.js during startup
module.exports.getSettings = () => settings;
```

Settings GET is public (dashboard reads heading), PUT requires auth via inline `requireAuth`:

```javascript
router.put('/', requireAuth, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (settings.hasOwnProperty(key)) {
      settings[key] = value;
    }
  }
});
```

## Security Utilities

`src/utils/security.js` provides primitives used across all auth routes.

| Function | Purpose | Used By |
|----------|---------|---------|
| `hashPassword(plain)` | bcrypt hash (12 rounds) | change-password route |
| `verifyPassword(plain, hash)` | bcrypt compare | login, change-password |
| `safeCompare(a, b)` | Constant-time string comparison | login (username + initial password) |
| `logSecurityEvent(event, details)` | Color-coded security logging | All auth routes |
| `getClientIP(req)` | Extract IP from x-forwarded-for or socket | All auth routes, rate limiters |

### Constant-Time Comparison

```javascript
// src/utils/security.js — prevents timing attacks on username/password
function safeCompare(a, b) {
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, '\0');
  const paddedB = b.padEnd(maxLen, '\0');
  return crypto.timingSafeEqual(Buffer.from(paddedA), Buffer.from(paddedB));
}
```

## WebSocket Session Sharing

The `sessionParser` function is passed to the WebSocket server to authenticate upgrade requests. See the **websocket** skill for full connection lifecycle.

```javascript
// src/app.js — passing session parser to WS setup
const wss = setupWebSocketServer(server, sessionParser);

// src/websocket/ws-server.js — using it during upgrade
httpServer.on('upgrade', (request, socket, head) => {
  authenticateUpgrade(request, socket, sessionParser)
    .then((session) => {
      ws.userId = session ? session.userId : 'anonymous-' + Date.now();
      ws.isAuthenticated = !!session;
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
});
```

## WARNING: Service Anti-Patterns

### Mixing Route Logic with Service Logic

**The Problem:** `src/routes/change-password.js` exports both a router and helper functions from the same module. This works for a single-admin app but becomes brittle if features grow.

**When You Might Be Tempted:** Adding a second auth-related route that needs `isPasswordHashed()`.

**The Fix:** If the app grows beyond single-admin, extract password state management into `src/services/password-service.js` and import from both routes.

### Storing Secrets in Settings Object

**The Problem:**

```javascript
// BAD — settings object is readable via GET /api/settings (public)
settings.sessionSecret = process.env.SESSION_SECRET;
```

**Why This Breaks:** GET /api/settings is public and returns the entire `settings` object. Any secret added to it leaks to unauthenticated users.

**The Fix:** Keep secrets in environment variables only. The `settings` object should contain only UI-safe configuration.

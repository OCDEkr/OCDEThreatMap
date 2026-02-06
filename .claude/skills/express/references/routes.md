# Routes Reference

## Contents
- Route Inventory
- Route Module Pattern
- Mounting and Rate Limiting
- File Upload Routes
- Static File Serving
- Anti-Patterns

## Route Inventory

All routes live in `src/routes/`. Inline routes defined in `src/app.js`.

| Method | Path | Auth | Rate Limit | Handler |
|--------|------|------|------------|---------|
| GET | `/` | No | No | Redirect to `/dashboard` (inline) |
| GET | `/dashboard` | No | No | Serve `dashboard.html` (inline) |
| GET | `/login` | No | No | Serve `login.html`, redirect if authed (inline) |
| GET | `/admin` | Yes | No | Serve `admin.html` (inline) |
| GET | `/api/auth/status` | No | API | Auth state check (inline) |
| POST | `/login` | No | 5/15min | `src/routes/login.js` |
| POST | `/logout` | No | No | `src/routes/logout.js` |
| POST | `/api/change-password` | Yes | 3/hr | `src/routes/change-password.js` |
| GET | `/api/settings` | No | API | `src/routes/settings.js` |
| GET | `/api/settings/:key` | No | API | `src/routes/settings.js` |
| PUT | `/api/settings` | Yes | API | `src/routes/settings.js` |
| PUT | `/api/settings/:key` | Yes | API | `src/routes/settings.js` |
| GET | `/api/logo` | No | API | `src/routes/logo.js` |
| POST | `/api/logo` | Yes | API | `src/routes/logo.js` (Multer) |
| DELETE | `/api/logo` | Yes | API | `src/routes/logo.js` |

## Route Module Pattern

Every route file follows the same structure:

```javascript
// src/routes/my-route.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth-check');

// Routes handle '/' because prefix is set at mount time
router.post('/', async (req, res) => {
  const { field } = req.body;
  if (!field) {
    return res.status(400).json({ success: false, error: 'Field required' });
  }
  res.json({ success: true });
});

module.exports = router;
```

Export pattern — `module.exports = router` for the router, plus named exports for shared state:

```javascript
// src/routes/change-password.js — exports both router and helpers
module.exports = router;
module.exports.getCurrentPassword = getCurrentPassword;
module.exports.getPasswordHash = getPasswordHash;
module.exports.isPasswordHashed = isPasswordHashed;
```

## Mounting and Rate Limiting

Routes mounted in `src/app.js` with optional middleware chains:

```javascript
// Simple mount
app.use('/logout', logoutRouter);

// Rate-limited mount
app.use('/login', loginLimiter, loginRouter);

// Rate-limited + auth-protected
app.use('/api/change-password', passwordChangeLimiter, requireAuth, changePasswordRouter);

// Mixed auth (GET public, PUT protected inside router)
app.use('/api/settings', settingsRouter);
```

## File Upload Routes

Logo upload uses Multer with strict validation in `src/routes/logo.js`:

```javascript
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, 'custom-logo' + path.extname(file.originalname).toLowerCase())
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
  cb(allowedTypes.includes(file.mimetype) ? null : new Error('Invalid file type'), allowedTypes.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', requireAuth, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  res.json({ success: true, logoUrl: '/uploads/' + req.file.filename });
});
```

Multer errors require a dedicated error handler on the router:

```javascript
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) return res.status(400).json({ success: false, error: err.message });
  next();
});
```

## Static File Serving

```javascript
// Serve entire public directory
app.use(express.static('public'));

// Alias a node_modules file to a client-accessible path
app.use('/js/reconnecting-websocket.min.js',
  express.static('node_modules/reconnecting-websocket/dist/reconnecting-websocket-iife.min.js'));
```

## WARNING: Business Logic in Route Handlers

**The Problem:**

```javascript
// BAD — route handler does everything
router.post('/', async (req, res) => {
  const geo = await maxmind.open('data/GeoLite2-City.mmdb');
  const result = geo.get(req.body.ip);
  res.json({ lat: result.location.latitude });
});
```

**Why This Breaks:**
1. Untestable without spinning up HTTP
2. Service initialization on every request
3. Cannot reuse logic in WebSocket handlers or event listeners

**The Fix:**

```javascript
// GOOD — thin route, logic in service
const geoLocator = require('../enrichment/geolocation');
router.post('/', async (req, res) => {
  const result = geoLocator.get(req.body.ip);
  res.json({ success: true, data: result });
});
```

## WARNING: Missing Input Validation at Route Boundary

**The Problem:**

```javascript
// BAD — trusting req.body blindly
router.put('/', requireAuth, (req, res) => {
  settings[req.body.key] = req.body.value;
});
```

**Why This Breaks:**
1. Prototype pollution if `key` is `__proto__` or `constructor`
2. Type confusion if value is unexpected type
3. Arbitrary property injection

**The Fix:**

```javascript
// GOOD — validate against known keys (actual pattern from settings.js)
for (const [key, value] of Object.entries(updates)) {
  if (settings.hasOwnProperty(key)) {
    settings[key] = value;
    updated.push(key);
  }
}
```

## JSON Response Envelope

All API routes use `{ success: boolean }` envelope:

```javascript
// Success
res.json({ success: true, data: result });

// Client error
res.status(400).json({ success: false, error: 'Validation message' });

// Auth error — generic to prevent enumeration
res.status(401).json({ success: false, error: 'Invalid credentials' });

// Server error
res.status(500).json({ success: false, error: 'Operation failed' });
```

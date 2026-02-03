# Routes Reference

## Contents
- Route Structure
- Route Patterns
- Mounting Routes
- Protected Routes
- Anti-Patterns

## Route Structure

Routes live in `src/routes/` as separate modules. Each exports an `express.Router()` instance.

```
src/routes/
├── login.js     # POST /login - credential validation
└── logout.js    # POST /logout - session destruction
```

## Route Patterns

### Basic POST Route

```javascript
// src/routes/login.js
const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  const { username, password } = req.body;
  
  if (username === validUsername && password === validPassword) {
    req.session.userId = username;
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

module.exports = router;
```

### Session Destruction Route

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

### File Serving Route

```javascript
// Protected dashboard with auth middleware
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});
```

## Mounting Routes

Routes are mounted in `src/app.js`:

```javascript
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');

app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
```

### Static File Serving

```javascript
// Serve public directory
app.use(express.static('public'));

// Serve node_modules library at custom path
app.use('/js/reconnecting-websocket.min.js', 
  express.static('node_modules/reconnecting-websocket/dist/reconnecting-websocket-iife.min.js'));
```

## Protected Routes

Use `requireAuth` middleware from `src/middleware/auth-check.js`:

```javascript
const { requireAuth } = require('./middleware/auth-check');

// Single protected route
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Protected route group (if needed)
app.use('/api', requireAuth, apiRouter);
```

## WARNING: Business Logic in Routes

**The Problem:**

```javascript
// BAD - business logic embedded in route handler
router.post('/', async (req, res) => {
  const geo = await maxmind.open('data/GeoLite2-City.mmdb');
  const result = geo.get(req.body.ip);
  const formatted = { lat: result.location.latitude, ... };
  res.json(formatted);
});
```

**Why This Breaks:**
1. Untestable without HTTP layer
2. Database/service initialization on every request
3. Hard to reuse logic elsewhere

**The Fix:**

```javascript
// GOOD - delegate to service
const { geoService } = require('../services/geo-service');

router.post('/', async (req, res) => {
  const result = await geoService.lookup(req.body.ip);
  res.json(result);
});
```

## WARNING: Missing Input Validation

**The Problem:**

```javascript
// BAD - trusting req.body blindly
router.post('/', (req, res) => {
  const { username, password } = req.body;
  // No validation - could be undefined, wrong type, etc.
});
```

**The Fix:**

```javascript
// GOOD - validate at boundary
router.post('/', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username required' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }
  // Now safe to proceed
});
```

## Redirect Pattern

```javascript
// Root redirects to dashboard (which then checks auth)
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});
```
# Routes Reference

## Contents
- Login Route Pattern
- Logout Route Pattern
- Protected Route Pattern
- Route Mounting
- WARNING: Common Route Mistakes

## Login Route Pattern

The login route validates credentials and establishes session state.

```javascript
// src/routes/login.js
const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  const { username, password } = req.body;
  
  const validUsername = process.env.DASHBOARD_USERNAME || 'admin';
  const validPassword = process.env.DASHBOARD_PASSWORD || 'change-me';
  
  if (username === validUsername && password === validPassword) {
    req.session.userId = username;
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

module.exports = router;
```

## Logout Route Pattern

Proper session destruction with error handling.

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

## Protected Route Pattern

Apply `requireAuth` middleware to sensitive routes.

```javascript
// src/app.js
const { requireAuth } = require('./middleware/auth-check');

// Protected routes
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Public routes (no middleware)
app.use('/login', loginRouter);
```

## Route Mounting

```javascript
// src/app.js - Correct order
app.use(bodyParser.json());    // Parse JSON bodies first
app.use(sessionParser);        // Session middleware second
app.use(express.static('public')); // Static files

// Mount route modules
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
```

## WARNING: Common Route Mistakes

### Middleware Order Matters

**The Problem:**

```javascript
// BAD - Session middleware AFTER routes
app.use('/login', loginRouter);
app.use(sessionParser);  // Too late - login route has no session
```

**Why This Breaks:**
1. Routes mounted before session middleware won't have `req.session`
2. Login will fail silently or throw undefined errors
3. Session cookies won't be set

**The Fix:**

```javascript
// GOOD - Session middleware BEFORE routes
app.use(sessionParser);
app.use('/login', loginRouter);
```

### Missing Error Response in Logout

**The Problem:**

```javascript
// BAD - Ignoring destroy callback errors
router.post('/', (req, res) => {
  req.session.destroy();
  res.json({ success: true });  // May respond before destroy completes
});
```

**Why This Breaks:**
1. Session may still exist in store if destroy fails
2. Client thinks logout succeeded when it didn't
3. Race condition with response

**The Fix:**

```javascript
// GOOD - Handle destroy callback
router.post('/', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});
```

### Truthy vs Strict Equality Check

**The Problem:**

```javascript
// BAD - Truthy check allows unexpected values
if (req.session.authenticated) {
  next();
}
```

**Why This Breaks:**
1. String `'false'` is truthy
2. Any non-empty value passes
3. Type coercion vulnerabilities

**The Fix:**

```javascript
// GOOD - Strict equality check
if (req.session && req.session.authenticated === true) {
  next();
}
```

## Integration with Express Router

See the **express** skill for router patterns and middleware chaining.
/**
 * Session Configuration
 * Provides express-session middleware for session-based authentication
 */

const session = require('express-session');

// Session middleware configuration
const sessionParser = session({
  secret: process.env.SESSION_SECRET || 'ocde-threat-map-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // Prevent XSS attacks
    secure: false,       // Set to true in production with HTTPS
    sameSite: 'strict',  // Prevent CSRF attacks
    maxAge: 24 * 60 * 60 * 1000  // 24 hours (86400000ms)
  }
});

// Note: In production, set SESSION_SECRET environment variable
// and configure cookie.secure = true when using HTTPS/TLS

module.exports = { sessionParser };

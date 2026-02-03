/**
 * Session Configuration
 * Provides express-session middleware for session-based authentication
 * Security: httpOnly, sameSite strict, secure in production
 */

const session = require('express-session');

// Determine if running in production
const isProduction = process.env.NODE_ENV === 'production';

// Validate session secret
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.warn('[SECURITY WARNING] SESSION_SECRET is missing or too short. Generate a secure secret for production.');
}

// Session middleware configuration
const sessionParser = session({
  secret: sessionSecret || 'ocde-threat-map-change-in-production',
  name: 'ocde.sid',  // Custom cookie name (not default 'connect.sid')
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,           // Prevent XSS attacks - JS cannot access cookie
    secure: isProduction,     // Only send over HTTPS in production
    sameSite: 'lax',          // Lax allows WebSocket upgrades while preventing most CSRF
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
});

if (isProduction) {
  console.log('[Session] Production mode: secure cookies enabled');
} else {
  console.log('[Session] Development mode: secure cookies disabled (enable HTTPS for production)');
}

module.exports = { sessionParser };

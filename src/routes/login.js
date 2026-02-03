/**
 * Login Route
 * Handles username/password authentication with security measures
 */

const express = require('express');
const router = express.Router();
const { getCurrentPassword, getPasswordHash, isPasswordHashed } = require('./change-password');
const { verifyPassword, safeCompare, logSecurityEvent, getClientIP } = require('../utils/security');

/**
 * POST /login
 * Validates credentials and creates session
 * Body: { username: string, password: string }
 * Returns: { success: boolean, error?: string }
 */
router.post('/', async (req, res) => {
  const { username, password } = req.body;
  const clientIP = getClientIP(req);

  // Input validation
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  // Get valid credentials
  const validUsername = process.env.DASHBOARD_USERNAME || 'admin';

  // Check username with constant-time comparison
  const usernameValid = safeCompare(username, validUsername);

  // Check password - use bcrypt if hashed, otherwise constant-time compare
  let passwordValid = false;

  if (isPasswordHashed()) {
    // Password is hashed - use bcrypt verify
    const hash = getPasswordHash();
    passwordValid = await verifyPassword(password, hash);
  } else {
    // Password is plain text (from env) - use constant-time compare
    const validPassword = getCurrentPassword();
    passwordValid = safeCompare(password, validPassword);
  }

  // Both must be valid
  if (usernameValid && passwordValid) {
    // Create authenticated session
    req.session.userId = username;
    req.session.authenticated = true;
    req.session.loginTime = Date.now();
    req.session.ip = clientIP;

    logSecurityEvent('login_success', {
      username,
      ip: clientIP
    });

    res.json({ success: true });
  } else {
    // Invalid credentials - log failed attempt
    logSecurityEvent('login_failed', {
      username,
      ip: clientIP,
      reason: !usernameValid ? 'invalid_username' : 'invalid_password'
    });

    // Generic error message to prevent username enumeration
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

module.exports = router;

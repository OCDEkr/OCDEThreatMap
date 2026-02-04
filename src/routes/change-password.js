/**
 * Change Password Route
 * Handles admin password changes with bcrypt hashing and file persistence
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { hashPassword, verifyPassword, safeCompare, logSecurityEvent, getClientIP } = require('../utils/security');

// Password hash file location (outside public directory for security)
const PASSWORD_FILE = path.join(__dirname, '..', '..', 'data', 'password.hash');

// Ensure data directory exists
const dataDir = path.dirname(PASSWORD_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// In-memory password hash (loaded from file on startup)
let passwordHash = null;

// Load existing password hash from file on startup
function loadPasswordHash() {
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      passwordHash = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
      console.log('[Password] Loaded existing password hash from file');
      return true;
    }
  } catch (err) {
    console.error('[Password] Error loading hash file:', err.message);
  }
  return false;
}

// Save password hash to file
function savePasswordHash(hash) {
  try {
    fs.writeFileSync(PASSWORD_FILE, hash, { mode: 0o600 }); // Read/write only for owner
    console.log('[Password] Password hash saved to file');
    return true;
  } catch (err) {
    console.error('[Password] Error saving hash file:', err.message);
    return false;
  }
}

// Load hash on module load
loadPasswordHash();

/**
 * Check if password is currently hashed (has been changed or loaded from file)
 */
function isPasswordHashed() {
  return passwordHash !== null;
}

/**
 * Get the password hash (for verification)
 */
function getPasswordHash() {
  return passwordHash;
}

/**
 * Get current password (plain text from env, for initial login only)
 */
function getCurrentPassword() {
  return process.env.DASHBOARD_PASSWORD || 'ChangeMe';
}

/**
 * POST /api/change-password
 * Changes the admin password with bcrypt hashing
 * Body: { currentPassword: string, newPassword: string }
 * Returns: { success: boolean, error?: string }
 */
router.post('/', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const clientIP = getClientIP(req);

  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current password and new password are required'
    });
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 8 characters'
    });
  }

  // Check for password complexity
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  if (!hasLower || !hasUpper || !hasNumber) {
    return res.status(400).json({
      success: false,
      error: 'Password must contain lowercase, uppercase, and numbers'
    });
  }

  // Verify current password
  let currentPasswordValid = false;

  if (isPasswordHashed()) {
    // Password has been changed before - verify against hash
    currentPasswordValid = await verifyPassword(currentPassword, passwordHash);
  } else {
    // First password change - verify against env variable
    const envPassword = getCurrentPassword();
    currentPasswordValid = safeCompare(currentPassword, envPassword);
  }

  if (!currentPasswordValid) {
    logSecurityEvent('password_change_failed', {
      ip: clientIP,
      reason: 'invalid_current_password'
    });

    return res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    });
  }

  try {
    // Hash the new password
    const newHash = await hashPassword(newPassword);

    // Save to file for persistence
    if (!savePasswordHash(newHash)) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save password'
      });
    }

    // Update in-memory hash
    passwordHash = newHash;

    logSecurityEvent('password_changed', {
      ip: clientIP,
      username: req.session?.userId || 'unknown'
    });

    // Invalidate other sessions by regenerating current session
    if (req.session) {
      const userId = req.session.userId;
      req.session.regenerate((err) => {
        if (!err) {
          req.session.userId = userId;
          req.session.authenticated = true;
          req.session.passwordChangedAt = Date.now();
        }
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    console.error('[Password] Hash error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// Export router and helper functions
module.exports = router;
module.exports.getCurrentPassword = getCurrentPassword;
module.exports.getPasswordHash = getPasswordHash;
module.exports.isPasswordHashed = isPasswordHashed;

/**
 * Security Utilities
 * Password hashing, constant-time comparison, and security logging
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash using bcrypt
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash to compare against
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.error('[Security] Password verification error:', err.message);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings are equal
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Pad to same length to prevent length-based timing leaks
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, '\0');
  const paddedB = b.padEnd(maxLen, '\0');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(paddedA, 'utf8'),
      Buffer.from(paddedB, 'utf8')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Log security events
 * @param {string} event - Event type (login_success, login_failed, etc.)
 * @param {Object} details - Event details
 */
function logSecurityEvent(event, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details
  };

  // Color-coded console output
  const colors = {
    login_success: '\x1b[32m',   // Green
    login_failed: '\x1b[31m',    // Red
    password_changed: '\x1b[33m', // Yellow
    logout: '\x1b[36m',          // Cyan
    rate_limited: '\x1b[35m',    // Magenta
    default: '\x1b[0m'           // Reset
  };

  const color = colors[event] || colors.default;
  const reset = '\x1b[0m';

  console.log(`${color}[SECURITY] ${timestamp} | ${event.toUpperCase()} | ${JSON.stringify(details)}${reset}`);
}

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of string to generate
 * @returns {string} - Random hex string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  safeCompare,
  logSecurityEvent,
  getClientIP,
  generateSecureToken
};

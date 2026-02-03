/**
 * Logout Route
 * Handles session destruction with security logging
 */

const express = require('express');
const router = express.Router();
const { logSecurityEvent, getClientIP } = require('../utils/security');

/**
 * POST /logout
 * Destroys the current session
 * Returns: { success: boolean, error?: string }
 */
router.post('/', (req, res) => {
  const clientIP = getClientIP(req);
  const username = req.session?.userId || 'unknown';

  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({
        error: 'Logout failed'
      });
    }

    logSecurityEvent('logout', {
      username,
      ip: clientIP
    });

    // Clear the session cookie (using custom cookie name)
    res.clearCookie('ocde.sid');
    res.json({ success: true });
  });
});

module.exports = router;

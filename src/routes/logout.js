/**
 * Logout Route
 * Handles session destruction
 */

const express = require('express');
const router = express.Router();

/**
 * POST /logout
 * Destroys the current session
 * Returns: { success: boolean, error?: string }
 */
router.post('/', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({
        error: 'Logout failed'
      });
    }

    res.json({ success: true });
  });
});

module.exports = router;

/**
 * Login Route
 * Handles username/password authentication
 */

const express = require('express');
const router = express.Router();

/**
 * POST /login
 * Validates credentials and creates session
 * Body: { username: string, password: string }
 * Returns: { success: boolean, error?: string }
 */
router.post('/', (req, res) => {
  const { username, password } = req.body;

  // Get credentials from environment variables
  const validUsername = process.env.DASHBOARD_USERNAME || 'admin';
  const validPassword = process.env.DASHBOARD_PASSWORD || 'change-me';

  // Validate credentials
  if (username === validUsername && password === validPassword) {
    // Create authenticated session
    req.session.userId = username;
    req.session.authenticated = true;

    res.json({ success: true });
  } else {
    // Invalid credentials
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

module.exports = router;

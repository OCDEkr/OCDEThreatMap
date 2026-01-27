/**
 * Authentication Middleware
 * Protects routes by requiring valid session
 */

/**
 * Middleware to require authentication
 * Checks if request has valid session with authenticated flag
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireAuth };

/**
 * Authentication Middleware
 * Protects routes by requiring valid session
 */

/**
 * Middleware to require authentication
 * Checks if request has valid session with authenticated flag
 * Redirects to login for HTML requests, returns 401 for API requests
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    next();
  } else {
    // Check if this is an API request (expects JSON) or HTML request
    const acceptHeader = req.headers.accept || '';
    const isApiRequest = req.path.startsWith('/api') ||
                         acceptHeader.includes('application/json') ||
                         req.xhr;

    if (isApiRequest) {
      res.status(401).json({ error: 'Not authenticated' });
    } else {
      // Redirect to login page for HTML requests
      res.redirect('/login');
    }
  }
}

module.exports = { requireAuth };

/**
 * WebSocket Authentication Handler
 * Validates session during WebSocket upgrade
 */

/**
 * Authenticates WebSocket upgrade request using session
 * @param {http.IncomingMessage} request - HTTP upgrade request
 * @param {net.Socket} socket - TCP socket
 * @param {Function} sessionParser - express-session middleware
 * @returns {Promise<Object>} Resolves with session if authenticated, rejects if not
 */
function authenticateUpgrade(request, socket, sessionParser) {
  return new Promise((resolve, reject) => {
    // Parse session from cookies
    sessionParser(request, {}, () => {
      // Check if session exists and user is authenticated
      if (request.session && request.session.authenticated === true) {
        resolve(request.session);
      } else {
        reject(new Error('Not authenticated'));
      }
    });
  });
}

module.exports = { authenticateUpgrade };

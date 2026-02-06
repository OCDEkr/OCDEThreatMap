/**
 * WebSocket Server
 * Handles WebSocket connections with optional authentication and heartbeat
 * Dashboard connections are public; admin panel requires authentication
 */

const { WebSocketServer, WebSocket } = require('ws');
const { authenticateUpgrade } = require('./auth-handler');
const { startHeartbeat, heartbeatHandler } = require('./heartbeat');
const { broadcastAttack } = require('./attack-broadcaster');

let wss;

/**
 * Sets up WebSocket server with optional authentication and heartbeat
 * @param {http.Server} httpServer - HTTP server instance
 * @param {Function} sessionParser - express-session middleware
 */
function setupWebSocketServer(httpServer, sessionParser) {
  // Create WebSocket server in noServer mode (manual upgrade handling)
  wss = new WebSocketServer({
    noServer: true,
    clientTracking: true  // Enable wss.clients Set for broadcasting
  });

  // Handle HTTP upgrade to WebSocket
  httpServer.on('upgrade', (request, socket, head) => {
    console.log('[WS] Upgrade request received from:', request.headers.origin || 'unknown');
    console.log('[WS] Cookies present:', !!request.headers.cookie);

    // Authenticate using session (allows anonymous access)
    authenticateUpgrade(request, socket, sessionParser)
      .then((session) => {
        // session is null for anonymous users, or contains user data for authenticated users
        const userId = session ? session.userId : 'anonymous-' + Date.now();
        const isAuthenticated = !!session;

        console.log('[WS] Connection accepted for:', userId, isAuthenticated ? '(authenticated)' : '(anonymous)');

        // Complete WebSocket upgrade
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Attach session info to WebSocket
          ws.userId = userId;
          ws.isAuthenticated = isAuthenticated;
          // Emit connection event
          wss.emit('connection', ws, request);
        });
      });
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws, request) => {
    // Initialize heartbeat tracking
    ws.isAlive = true;
    ws.on('pong', heartbeatHandler);

    console.log('Client connected:', ws.userId);

    // Handle connection close
    ws.on('close', () => {
      ws.isAlive = false;
      console.log('Client disconnected:', ws.userId);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      ws.isAlive = false;
      ws.terminate();
    });

    // Send current threat feed items to newly connected client
    try {
      const { getFeedItems } = require('../routes/threat-feed');
      const items = getFeedItems();
      if (items.length > 0) {
        ws.send(JSON.stringify({ type: 'threat-feed', items, count: items.length }));
      }
    } catch (err) {
      // threat-feed module not yet loaded — skip
    }
  });

  // Start heartbeat mechanism
  startHeartbeat(wss);

  console.log('WebSocket server ready');

  // Return wss for broadcast wiring
  return wss;
}

module.exports = { setupWebSocketServer, wss };

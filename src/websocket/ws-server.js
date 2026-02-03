/**
 * WebSocket Server
 * Handles WebSocket connections with session authentication and heartbeat
 */

const { WebSocketServer, WebSocket } = require('ws');
const { authenticateUpgrade } = require('./auth-handler');
const { startHeartbeat, heartbeatHandler } = require('./heartbeat');
const { broadcastAttack } = require('./attack-broadcaster');

let wss;

/**
 * Sets up WebSocket server with authentication and heartbeat
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

    // Authenticate using session
    authenticateUpgrade(request, socket, sessionParser)
      .then((session) => {
        console.log('[WS] Authentication successful for:', session.userId);
        // Authentication successful - complete upgrade
        wss.handleUpgrade(request, socket, head, (ws) => {
          // Attach session info to WebSocket
          ws.userId = session.userId;
          // Emit connection event
          wss.emit('connection', ws, request);
        });
      })
      .catch((err) => {
        // Authentication failed - reject connection
        console.log('[WS] Authentication failed:', err.message);
        console.log('[WS] Session data:', request.session ? JSON.stringify(request.session) : 'no session');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
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
  });

  // Start heartbeat mechanism
  startHeartbeat(wss);

  console.log('WebSocket server ready');

  // Return wss for broadcast wiring
  return wss;
}

module.exports = { setupWebSocketServer, wss };

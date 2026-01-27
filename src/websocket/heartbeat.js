/**
 * WebSocket Heartbeat Mechanism
 * Implements ping/pong pattern to detect and terminate dead connections
 */

// Constants
const HEARTBEAT_INTERVAL = 30000;  // 30 seconds
const HEARTBEAT_TIMEOUT = 35000;   // 35 seconds (not actively used, documented for reference)

/**
 * Heartbeat handler - called when client responds with pong
 * Sets isAlive flag to true, indicating connection is healthy
 * This function is bound to the WebSocket instance
 */
function heartbeatHandler() {
  this.isAlive = true;
}

/**
 * Starts heartbeat mechanism for WebSocket server
 * Sends ping frames every 30 seconds
 * Terminates connections that don't respond with pong
 * @param {WebSocketServer} wss - WebSocket server instance
 */
function startHeartbeat(wss) {
  // Check for broken connections every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      // If client didn't respond to last ping, terminate connection
      if (ws.isAlive === false) {
        console.log('Terminating dead connection');
        return ws.terminate();
      }

      // Mark as not alive and send ping
      // If client responds with pong, heartbeatHandler will set isAlive back to true
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  // Clean up interval when server closes
  wss.on('close', () => {
    clearInterval(interval);
  });
}

module.exports = { startHeartbeat, heartbeatHandler };

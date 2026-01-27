/**
 * WebSocket Broadcaster
 * Broadcasts enriched events to all connected WebSocket clients
 */

const { WebSocket } = require('ws');
const eventBus = require('../events/event-bus');

// Module-level WebSocket server reference (set by wireEventBroadcast)
let wss = null;

/**
 * Broadcast data to all OPEN WebSocket clients
 * @param {Object} data - Data to broadcast (will be JSON stringified)
 */
function broadcast(data) {
  if (!wss) {
    console.error('[Broadcaster] ERROR: WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify(data);
  let successCount = 0;
  let failureCount = 0;

  // Iterate all connected clients
  for (const client of wss.clients) {
    // Only send to OPEN connections (skip CONNECTING, CLOSING, CLOSED)
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        successCount++;
      } catch (err) {
        console.error('[Broadcaster] Send failed:', err.message);
        failureCount++;
        // Terminate broken connection
        client.terminate();
      }
    }
  }

  // Log warning if any sends failed
  if (failureCount > 0) {
    console.warn(`[Broadcaster] Broadcast: ${successCount} succeeded, ${failureCount} failed`);
  }
}

/**
 * Wire event broadcast to enriched events from eventBus
 * @param {WebSocketServer} webSocketServer - WebSocket server instance
 */
function wireEventBroadcast(webSocketServer) {
  // Store WebSocket server reference
  wss = webSocketServer;

  // Listen to enriched events from EnrichmentPipeline
  eventBus.on('enriched', (event) => {
    // Format event for client consumption
    broadcast({
      type: 'attack',
      timestamp: event.timestamp,
      sourceIP: event.sourceIP,
      destinationIP: event.destinationIP,
      geo: event.geo,
      threatType: event.threatType
    });
  });

  console.log('Event broadcast wired to enriched events');
}

module.exports = { broadcast, wireEventBroadcast };

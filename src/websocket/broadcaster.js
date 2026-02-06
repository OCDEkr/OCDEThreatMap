/**
 * WebSocket Broadcaster
 * Broadcasts enriched events to all connected WebSocket clients
 */

const { WebSocket } = require('ws');
const eventBus = require('../events/event-bus');
const { broadcastAttack } = require('./attack-broadcaster');

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
    // Use attack-broadcaster for enriched events
    broadcastAttack(wss, event);
  });

  console.log('Event broadcast wired to enriched events');
}

/**
 * Broadcast threat feed items to all connected clients
 * @param {Array} items - Current non-expired feed items
 */
function broadcastThreatFeed(items) {
  broadcast({ type: 'threat-feed', items, count: items.length });
}

module.exports = { broadcast, wireEventBroadcast, broadcastThreatFeed };

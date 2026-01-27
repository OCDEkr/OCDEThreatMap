/**
 * Attack Event Broadcaster
 * Broadcasts enriched attack events to all connected WebSocket clients
 */

const { WebSocket } = require('ws');

/**
 * Broadcast attack event to all connected WebSocket clients
 * @param {WebSocketServer} wss - WebSocket server instance
 * @param {Object} event - Enriched event from geolocation pipeline
 * @returns {boolean} - True if broadcast succeeded, false if skipped
 */
function broadcastAttack(wss, event) {
  // Check if event has geo data from enrichment
  if (!event.geo || !event.geo.country) {
    console.log('[Attack Broadcaster] Skipping event without geo data');
    return false;
  }

  // Prepare broadcast message
  const message = {
    type: 'enriched',
    timestamp: event.timestamp || new Date().toISOString(),
    geo: event.geo,
    attack: {
      source_ip: event.sourceIP,
      destination_ip: event.destinationIP,
      destination_port: event.destinationPort,
      service: event.service || 'unknown',
      threat_type: event.threatType || 'unknown'
    }
  };

  // Broadcast to all connected clients
  let successCount = 0;
  let failureCount = 0;
  const messageStr = JSON.stringify(message);

  for (const client of wss.clients) {
    // Only send to OPEN connections
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        successCount++;
      } catch (err) {
        console.error('[Attack Broadcaster] Send failed:', err.message);
        failureCount++;
        // Terminate broken connection
        client.terminate();
      }
    }
  }

  console.log(`[Attack Broadcaster] Broadcast attack from ${event.geo.country} to ${successCount} clients`);

  if (failureCount > 0) {
    console.warn(`[Attack Broadcaster] ${failureCount} clients failed to receive message`);
  }

  return true;
}

module.exports = { broadcastAttack };

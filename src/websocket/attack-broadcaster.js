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
  // Prepare broadcast message with geo data if available
  // Broadcast ALL events, even without geo data (graceful degradation)
  const message = {
    type: 'enriched',
    timestamp: event.timestamp || new Date().toISOString(),
    geo: event.geo ? {
      ...event.geo,
      country_code: event.geo.country  // Dashboard expects country_code
    } : null,  // null if no geo data available
    sourceIP: event.sourceIP,  // Add top-level sourceIP for display
    destinationIP: event.destinationIP,
    isOCDETarget: event.isOCDETarget,
    threatType: event.threatType,
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

  const source = event.geo ? event.geo.country : event.sourceIP;
  console.log(`[Attack Broadcaster] Broadcast attack from ${source} to ${successCount} clients`);

  if (failureCount > 0) {
    console.warn(`[Attack Broadcaster] ${failureCount} clients failed to receive message`);
  }

  return true;
}

module.exports = { broadcastAttack };

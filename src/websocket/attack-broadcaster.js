/**
 * Attack Event Broadcaster
 * Broadcasts enriched attack events to all connected WebSocket clients
 * Supports batching for high-volume scenarios
 */

const { WebSocket } = require('ws');

// Batching configuration
const BATCH_INTERVAL_MS = 100;  // Send batches every 100ms (10 batches/second)
const MAX_BATCH_SIZE = 50;      // Max events per batch
const LOG_INTERVAL_MS = 5000;   // Log stats every 5 seconds

// Batching state
let eventBatch = [];
let batchTimer = null;
let wssRef = null;

// Statistics
let totalBroadcast = 0;
let totalBatches = 0;
let lastLogTime = Date.now();

/**
 * Format event for broadcast
 * @param {Object} event - Enriched event from geolocation pipeline
 * @returns {Object} Formatted message
 */
function formatEvent(event) {
  return {
    timestamp: event.timestamp || new Date().toISOString(),
    geo: event.geo ? {
      ...event.geo,
      country_code: event.geo.country  // Dashboard expects country_code
    } : null,
    sourceIP: event.sourceIP,
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
}

/**
 * Flush the current batch to all clients
 */
function flushBatch() {
  if (!wssRef || eventBatch.length === 0) {
    return;
  }

  // Prepare batch message
  const message = {
    type: 'batch',
    count: eventBatch.length,
    events: eventBatch
  };

  const messageStr = JSON.stringify(message);
  let successCount = 0;

  // Broadcast to all connected clients
  for (const client of wssRef.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        successCount++;
      } catch (err) {
        client.terminate();
      }
    }
  }

  // Update statistics
  totalBroadcast += eventBatch.length;
  totalBatches++;

  // Clear the batch
  eventBatch = [];

  // Periodic logging (every 5 seconds)
  const now = Date.now();
  if (now - lastLogTime >= LOG_INTERVAL_MS) {
    const eventsPerSecond = Math.round(totalBroadcast / ((now - lastLogTime) / 1000));
    console.log(`[Broadcaster] ${totalBroadcast} events in ${totalBatches} batches (${eventsPerSecond}/sec) to ${successCount} clients`);
    totalBroadcast = 0;
    totalBatches = 0;
    lastLogTime = now;
  }
}

/**
 * Queue attack event for batched broadcast
 * @param {WebSocketServer} wss - WebSocket server instance
 * @param {Object} event - Enriched event from geolocation pipeline
 * @returns {boolean} - True if queued successfully
 */
function broadcastAttack(wss, event) {
  // Store reference for flush
  wssRef = wss;

  // Format and add to batch
  eventBatch.push(formatEvent(event));

  // Start batch timer if not running
  if (!batchTimer) {
    batchTimer = setInterval(() => {
      flushBatch();
    }, BATCH_INTERVAL_MS);
  }

  // Flush immediately if batch is full
  if (eventBatch.length >= MAX_BATCH_SIZE) {
    flushBatch();
  }

  return true;
}

/**
 * Get current batching statistics
 * @returns {Object} Stats object
 */
function getBatchStats() {
  return {
    pendingEvents: eventBatch.length,
    totalBroadcast,
    totalBatches,
    batchInterval: BATCH_INTERVAL_MS,
    maxBatchSize: MAX_BATCH_SIZE
  };
}

/**
 * Stop the batch timer (for graceful shutdown)
 */
function stopBatching() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  // Flush any remaining events
  flushBatch();
}

module.exports = { broadcastAttack, getBatchStats, stopBatching };

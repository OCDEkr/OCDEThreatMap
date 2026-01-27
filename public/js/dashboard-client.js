/**
 * Dashboard WebSocket Client
 * Connects to WebSocket server and wires enriched events to visualization layer
 */

(function() {
  let ws = null;
  let reconnectTimeout = null;
  let eventCount = 0;

  /**
   * Connect to WebSocket server
   */
  function connect() {
    // Match path pattern from ws-client.js
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}`;

    // Use ReconnectingWebSocket if available, else standard WebSocket
    if (typeof ReconnectingWebSocket !== 'undefined') {
      ws = new ReconnectingWebSocket(wsUrl, [], {
        connectionTimeout: 5000,
        maxRetries: Infinity,
        maxReconnectionDelay: 30000,
        minReconnectionDelay: 500,
        reconnectionDelayGrowFactor: 1.5,
        minUptime: 5000
      });
    } else {
      ws = new WebSocket(wsUrl);
    }

    ws.addEventListener('open', () => {
      console.log('Dashboard WebSocket connected');
      updateConnectionStatus('connected');
    });

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'enriched') {
          // Create arc on globe
          if (window.addAttackArc) {
            window.addAttackArc(data);
          }

          // Update statistics
          if (window.updateMetrics) {
            window.updateMetrics(data);
          }

          // Add to event log
          addEventToLog(data);

          eventCount++;
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    ws.addEventListener('close', () => {
      console.log('Dashboard WebSocket disconnected');
      updateConnectionStatus('disconnected');

      // Reconnect after 3 seconds if not using ReconnectingWebSocket
      if (typeof ReconnectingWebSocket === 'undefined') {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    });

    ws.addEventListener('error', (err) => {
      console.error('Dashboard WebSocket error:', err);
      updateConnectionStatus('disconnected');
    });
  }

  /**
   * Update connection status indicator
   * @param {string} status - 'connected' | 'disconnected' | 'connecting'
   */
  function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    statusElement.className = status;
    statusElement.textContent = status === 'connected' ? 'CONNECTED' :
                               status === 'connecting' ? 'CONNECTING...' :
                               'DISCONNECTED';
  }

  /**
   * Add event to the event log
   * @param {Object} data - Enriched event data
   */
  function addEventToLog(data) {
    const container = document.getElementById('events-container');
    if (!container) return;

    const eventDiv = document.createElement('div');
    eventDiv.className = 'event-item new';

    // Format event message
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    const country = data.geo?.country_code || 'Unknown';
    const city = data.geo?.city || 'Unknown';
    const port = data.attack?.destination_port || '?';
    const service = data.attack?.service || 'unknown';

    eventDiv.textContent = `[${timestamp}] Attack from ${country} (${city}) → Port ${port} (${service})`;

    // Add to top of log
    container.insertBefore(eventDiv, container.firstChild);

    // Remove animation class after animation completes
    setTimeout(() => eventDiv.classList.remove('new'), 500);

    // Keep only last 50 events
    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus('connecting');
    connect();
  });

  // Export for debugging
  window.dashboardClient = {
    getWebSocket: () => ws,
    getEventCount: () => eventCount
  };
})();

/**
 * Dashboard WebSocket Client
 * Connects to WebSocket server and wires enriched events to visualization layer
 */

(function() {
  let ws = null;
  let reconnectTimeout = null;
  let eventCount = 0;
  let ocdeFilterActive = false;  // Track OCDE filter state (false = show all, true = OCDE only)

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
          // Apply OCDE filter if active
          if (ocdeFilterActive && !data.isOCDETarget) {
            // Skip non-OCDE attacks when filter is on
            console.log('[Filter] Skipped non-OCDE attack from', data.sourceIP);
            return;
          }

          // Create arc on globe
          if (window.addAttackArc) {
            window.addAttackArc(data);
          }

          // Create arc on flat map (always add to both - only visible one will render)
          if (window.addFlatMapArc) {
            window.addFlatMapArc(data);
          }

          // Create arc on D3 flat map (D3.js version)
          if (window.addD3Arc) {
            // Extract coordinates from geolocation data
            const srcLat = data.geo?.latitude || 0;
            const srcLng = data.geo?.longitude || 0;
            const dstLat = 33.7490;  // OCDE latitude
            const dstLng = -117.8705; // OCDE longitude

            // Map threat type to colors
            const threatType = data.attack?.threat_type || data.threatType || 'default';
            const colorMap = {
              malware: ['rgba(255, 0, 0, 0.8)', 'rgba(255, 100, 0, 0.8)'],
              intrusion: ['rgba(255, 140, 0, 0.8)', 'rgba(255, 165, 0, 0.8)'],
              ddos: ['rgba(138, 43, 226, 0.8)', 'rgba(153, 50, 204, 0.8)'],
              default: ['rgba(255, 165, 0, 0.8)', 'rgba(255, 140, 0, 0.8)']
            };
            const color = colorMap[threatType] || colorMap.default;

            window.addD3Arc(srcLat, srcLng, dstLat, dstLng, color);
          }

          // Update statistics
          if (window.updateMetrics) {
            window.updateMetrics(data);
          }

          // Update top statistics (countries and attacks)
          if (window.updateTopStats) {
            window.updateTopStats(data);
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
    const threatType = data.attack?.threat_type || data.threatType || 'default';

    // Map threat type to colors (matching arc colors)
    const colorMap = {
      malware: '#ff0000',      // Red
      intrusion: '#ff8c00',    // Orange
      ddos: '#8a2be2',         // Purple
      default: '#ff8c00'       // Orange (default)
    };
    const textColor = colorMap[threatType] || colorMap.default;

    eventDiv.textContent = `[${timestamp}] Attack from ${country} (${city}) → Port ${port} (${service})`;
    eventDiv.style.color = textColor;

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

  // Export for debugging and filter control
  window.dashboardClient = {
    getWebSocket: () => ws,
    getEventCount: () => eventCount,
    getFilterState: () => ocdeFilterActive,
    setFilterState: (state) => {
      ocdeFilterActive = state;
      console.log('[Filter] State changed to:', state ? 'OCDE only' : 'All attacks');
    }
  };
})();

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

        // Handle batched events (new high-performance mode)
        if (data.type === 'batch' && Array.isArray(data.events)) {
          data.events.forEach(evt => processEvent(evt));
          return;
        }

        // Handle single enriched event (legacy/fallback)
        if (data.type === 'enriched') {
          processEvent(data);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    /**
     * Process a single enriched event
     * @param {Object} data - Enriched event data
     */
    function processEvent(data) {
      // Apply OCDE filter if active
      if (ocdeFilterActive && !data.isOCDETarget) {
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

        // Get country code for color mapping
        const countryCode = data.geo?.country || 'XX';

        // Get country color (shared function)
        const color = window.getCountryColorRgba ?
          window.getCountryColorRgba(countryCode) :
          ['rgba(255, 165, 0, 0.8)', 'rgba(255, 140, 0, 0.8)'];

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

      // Add to event log (only add every 10th event to reduce DOM updates)
      eventCount++;
      if (eventCount % 10 === 0 || eventCount < 50) {
        addEventToLog(data);
      }
    }

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
    const countryCode = data.geo?.country_code || data.geo?.country || 'XX';
    const countryName = data.geo?.countryName || countryCode;
    const city = data.geo?.city || 'Unknown';
    const port = data.attack?.destination_port || '?';
    const service = data.attack?.service || 'unknown';

    // Get country color matching arc color
    const countryColor = window.getCountryColorHex ? window.getCountryColorHex(countryCode) : '#ffa500';

    // Build HTML with colored country name
    eventDiv.innerHTML = `[${timestamp}] Attack from <span style="color: ${countryColor}; font-weight: bold; text-shadow: 0 0 5px ${countryColor};">${countryName}</span> (${city}) → Port ${port} (${service})`;
    eventDiv.style.color = '#888';  // Base color for non-country text

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

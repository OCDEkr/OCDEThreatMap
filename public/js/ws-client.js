/**
 * WebSocket Client with Auto-Reconnect
 * Handles authentication and real-time attack event display
 */

// Global WebSocket reference
let rws = null;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const loginForm = document.getElementById('login-form');
  const dashboard = document.getElementById('dashboard');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const connectionStatus = document.getElementById('connection-status');
  const eventLog = document.getElementById('event-log');

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';

    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        // Login successful - redirect to globe dashboard
        window.location.href = '/dashboard';
      } else {
        // Login failed
        loginError.style.display = 'block';
      }
    } catch (err) {
      console.error('Login error:', err);
      loginError.textContent = 'Connection error - please try again';
      loginError.style.display = 'block';
    }
  });

  // Handle navigation to globe dashboard
  const globeDashboardBtn = document.getElementById('globe-dashboard-btn');
  globeDashboardBtn.addEventListener('click', () => {
    window.location.href = '/dashboard';
  });

  // Handle logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/logout', { method: 'POST' });

      // Close WebSocket
      if (rws) {
        rws.close();
        rws = null;
      }

      // Show login form
      dashboard.style.display = 'none';
      loginForm.style.display = 'block';
      usernameInput.value = '';
      passwordInput.value = '';
      loginError.style.display = 'none';

      // Clear event log
      eventLog.innerHTML = '';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  /**
   * Connect to WebSocket server with auto-reconnect
   */
  function connectWebSocket() {
    // Create ReconnectingWebSocket with exponential backoff
    rws = new ReconnectingWebSocket('ws://localhost:3000', [], {
      connectionTimeout: 5000,
      maxRetries: Infinity,
      maxReconnectionDelay: 30000,
      minReconnectionDelay: 500,
      reconnectionDelayGrowFactor: 1.5,
      minUptime: 5000
    });

    // Connection opened
    rws.addEventListener('open', () => {
      console.log('WebSocket connected');
      updateConnectionStatus('connected');
    });

    // Message received
    rws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'attack') {
          displayAttackEvent(data);
        }
      } catch (err) {
        console.error('Message parse error:', err);
      }
    });

    // Connection closed
    rws.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus('disconnected');
    });

    // Connection error
    rws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      updateConnectionStatus('error');
    });
  }

  /**
   * Update connection status indicator
   * @param {string} status - 'connected' | 'disconnected' | 'error'
   */
  function updateConnectionStatus(status) {
    connectionStatus.className = `status-${status}`;

    switch (status) {
      case 'connected':
        connectionStatus.textContent = 'Connected';
        break;
      case 'disconnected':
        connectionStatus.textContent = 'Disconnected - Reconnecting...';
        break;
      case 'error':
        connectionStatus.textContent = 'Connection Error - Retrying...';
        break;
    }
  }

  /**
   * Display attack event in the event log
   * @param {Object} event - Attack event data
   */
  function displayAttackEvent(event) {
    // Create event element
    const eventDiv = document.createElement('div');
    eventDiv.className = 'attack-event';

    // Format geolocation
    const country = event.geo?.countryName || event.geo?.country || 'Unknown';
    const city = event.geo?.city || '';
    const location = city ? `${city}, ${country}` : country;

    // Format timestamp
    const timestamp = new Date(event.timestamp).toLocaleString();

    // Build event HTML
    eventDiv.innerHTML = `
      <div>
        <strong>Attack from ${event.sourceIP}</strong>
        <span class="country">(${location})</span>
      </div>
      <div>
        Target: ${event.destinationIP} | Threat: ${event.threatType || 'Unknown'}
      </div>
      <div class="timestamp">${timestamp}</div>
    `;

    // Add to event log (prepend for newest first)
    eventLog.insertBefore(eventDiv, eventLog.firstChild);

    // Limit to 50 events
    while (eventLog.children.length > 50) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }
});

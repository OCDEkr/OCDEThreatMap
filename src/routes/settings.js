/**
 * Settings Route
 * Handles dashboard customization settings
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth-check');

// Reference to broadcast function (set via setBroadcastFn)
let broadcastFn = null;

// In-memory settings storage (persists until server restart)
const settings = {
  heading: 'OCDE Threat Map',
  // Network binding settings (require restart to take effect)
  httpBindAddress: '127.0.0.1',      // Default to localhost for security
  syslogBindAddress: '127.0.0.1',    // Default to localhost for security
  httpPort: 3000,
  syslogPort: 514,
  // Display settings (applied live via WebSocket broadcast)
  maxArcs: 20,                       // Max arcs displayed at once (1-50)
};

/**
 * GET /api/settings
 * Returns all current settings
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    settings: settings
  });
});

/**
 * GET /api/settings/:key
 * Returns a specific setting value
 */
router.get('/:key', (req, res) => {
  const { key } = req.params;

  if (settings.hasOwnProperty(key)) {
    res.json({
      success: true,
      key: key,
      value: settings[key]
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Setting '${key}' not found`
    });
  }
});

/**
 * PUT /api/settings
 * Updates one or more settings (requires authentication)
 * Body: { heading: string, ... }
 */
router.put('/', requireAuth, (req, res) => {
  const updates = req.body;
  const updated = [];

  // Display settings that should be broadcast to dashboard clients
  const DISPLAY_SETTINGS = ['maxArcs'];

  // Only update known settings
  let hasDisplayChange = false;
  for (const [key, value] of Object.entries(updates)) {
    if (settings.hasOwnProperty(key)) {
      // Validate maxArcs range
      if (key === 'maxArcs') {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 50) {
          continue; // Skip invalid maxArcs values
        }
        settings[key] = n;
      } else {
        settings[key] = value;
      }
      updated.push(key);
      if (DISPLAY_SETTINGS.includes(key)) hasDisplayChange = true;
      console.log(`[Settings] Updated ${key}: ${settings[key]}`);
    }
  }

  if (updated.length > 0) {
    // Broadcast display setting changes to dashboard clients
    if (hasDisplayChange && broadcastFn) {
      broadcastFn(settings);
    }

    res.json({
      success: true,
      message: `Updated settings: ${updated.join(', ')}`,
      settings: settings
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'No valid settings provided'
    });
  }
});

/**
 * PUT /api/settings/:key
 * Updates a specific setting (requires authentication)
 * Body: { value: any }
 */
router.put('/:key', requireAuth, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!settings.hasOwnProperty(key)) {
    return res.status(404).json({
      success: false,
      error: `Setting '${key}' not found`
    });
  }

  if (value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Value is required'
    });
  }

  settings[key] = value;
  console.log(`[Settings] Updated ${key}: ${value}`);

  res.json({
    success: true,
    key: key,
    value: settings[key]
  });
});

module.exports = router;
module.exports.getSettings = () => settings;
module.exports.setSettingsBroadcastFn = (fn) => { broadcastFn = fn; };

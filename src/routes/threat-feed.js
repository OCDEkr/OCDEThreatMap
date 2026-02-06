/**
 * Threat Feed Route
 * Accepts threat intelligence advisories from N8N via API key auth,
 * persists to file, and broadcasts to dashboard clients
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { requireAuth } = require('../middleware/auth-check');
const { safeCompare, logSecurityEvent, getClientIP } = require('../utils/security');

const FEED_FILE = path.join(__dirname, '..', '..', 'data', 'threat-feed.json');
const MAX_ITEMS = 50;
const MAX_TEXT_LENGTH = 500;
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

// Demo items shown when no real data has been received
const DEMO_ITEMS = [
  { id: 'demo-1', text: 'CVE-2024-3400: Critical RCE in Palo Alto PAN-OS GlobalProtect - Patch immediately', severity: 'critical', source: 'CISA KEV', timestamp: new Date().toISOString(), expiresAt: null },
  { id: 'demo-2', text: 'IOC Alert: New C2 domain detected in DNS logs - malicious-c2.example.com', severity: 'high', source: 'ThreatIntel', timestamp: new Date().toISOString(), expiresAt: null },
  { id: 'demo-3', text: 'CVE-2024-21762: FortiOS out-of-bound write vulnerability actively exploited', severity: 'critical', source: 'Fortinet PSIRT', timestamp: new Date().toISOString(), expiresAt: null },
  { id: 'demo-4', text: 'Reminder: Monthly vulnerability scan scheduled for this weekend', severity: 'low', source: 'OCDE SOC', timestamp: new Date().toISOString(), expiresAt: null },
  { id: 'demo-5', text: 'APT29 campaign targeting education sector with spearphishing attachments', severity: 'high', source: 'CISA Alert', timestamp: new Date().toISOString(), expiresAt: null }
];

// In-memory feed items (loaded from file on startup)
let feedItems = loadFeedFromFile();

// Reference to broadcast function (set via setBroadcastFn)
let broadcastFn = null;

/**
 * Load feed items from persistent file
 * @returns {Array} Feed items or empty array
 */
function loadFeedFromFile() {
  try {
    if (fs.existsSync(FEED_FILE)) {
      const data = fs.readFileSync(FEED_FILE, 'utf8');
      const items = JSON.parse(data);
      if (Array.isArray(items)) {
        console.log(`[ThreatFeed] Loaded ${items.length} items from file`);
        return items;
      }
    }
  } catch (err) {
    console.error('[ThreatFeed] Error loading feed file:', err.message);
  }
  return [];
}

/**
 * Save feed items to persistent file
 */
function saveFeedToFile() {
  try {
    fs.writeFileSync(FEED_FILE, JSON.stringify(feedItems, null, 2), 'utf8');
  } catch (err) {
    console.error('[ThreatFeed] Error saving feed file:', err.message);
  }
}

/**
 * Filter out expired items (lazy expiration)
 * @returns {Array} Non-expired feed items
 */
function getActiveFeedItems() {
  const now = new Date().toISOString();
  feedItems = feedItems.filter(item => !item.expiresAt || item.expiresAt > now);
  return feedItems;
}

/**
 * Get current non-expired feed items (exported for ws-server initial send)
 * Returns demo items if no real data exists
 * @returns {Array} Active feed items or demo items
 */
function getFeedItems() {
  const active = getActiveFeedItems();
  return active.length > 0 ? active : DEMO_ITEMS;
}

/**
 * Set the broadcast function reference
 * @param {Function} fn - broadcastThreatFeed function from broadcaster
 */
function setBroadcastFn(fn) {
  broadcastFn = fn;
}

/**
 * Broadcast current feed state to all clients
 */
function broadcastCurrentFeed() {
  if (broadcastFn) {
    broadcastFn(getActiveFeedItems());
  }
}

/**
 * Validate API key from X-API-Token header
 * @param {Object} req - Express request
 * @returns {boolean} True if valid
 */
function validateApiKey(req) {
  const apiKey = process.env.THREAT_FEED_API_KEY;
  if (!apiKey) return false;

  const token = req.headers['x-api-token'];
  if (!token) return false;

  return safeCompare(token, apiKey);
}

/**
 * GET /api/threat-feed
 * Returns current non-expired items (public, for dashboard initial load)
 */
router.get('/', (req, res) => {
  const items = getActiveFeedItems();
  res.json({
    success: true,
    items,
    count: items.length
  });
});

/**
 * POST /api/threat-feed
 * Accept new advisories from N8N (API key required)
 * Body: single object or array of { text, severity?, source?, expiresAt? }
 */
router.post('/', (req, res) => {
  // Check if API key is configured
  if (!process.env.THREAT_FEED_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Threat feed API key not configured'
    });
  }

  // Validate API key
  if (!validateApiKey(req)) {
    logSecurityEvent('threat_feed_auth_failed', {
      ip: getClientIP(req)
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  // Accept single object or array
  const incoming = Array.isArray(req.body) ? req.body : [req.body];

  if (incoming.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No items provided'
    });
  }

  const added = [];
  for (const item of incoming) {
    if (!item.text || typeof item.text !== 'string') {
      continue; // Skip items without text
    }

    const feedItem = {
      id: crypto.randomUUID(),
      text: item.text.substring(0, MAX_TEXT_LENGTH),
      severity: VALID_SEVERITIES.includes(item.severity) ? item.severity : 'medium',
      source: typeof item.source === 'string' ? item.source.substring(0, 100) : 'N8N',
      timestamp: new Date().toISOString(),
      expiresAt: item.expiresAt || null
    };

    feedItems.push(feedItem);
    added.push(feedItem);
  }

  if (added.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid items provided (each item requires a "text" field)'
    });
  }

  // Evict oldest if over max
  while (feedItems.length > MAX_ITEMS) {
    feedItems.shift();
  }

  saveFeedToFile();
  broadcastCurrentFeed();

  console.log(`[ThreatFeed] Added ${added.length} items (total: ${feedItems.length})`);

  res.status(201).json({
    success: true,
    added: added.length,
    total: feedItems.length
  });
});

/**
 * DELETE /api/threat-feed/:id
 * Remove an item (admin session required)
 */
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const initialLength = feedItems.length;

  feedItems = feedItems.filter(item => item.id !== id);

  if (feedItems.length === initialLength) {
    return res.status(404).json({
      success: false,
      error: 'Item not found'
    });
  }

  saveFeedToFile();
  broadcastCurrentFeed();

  console.log(`[ThreatFeed] Deleted item ${id} (total: ${feedItems.length})`);

  res.json({
    success: true,
    total: feedItems.length
  });
});

module.exports = router;
module.exports.getFeedItems = getFeedItems;
module.exports.setBroadcastFn = setBroadcastFn;

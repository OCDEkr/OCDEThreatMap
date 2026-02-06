/**
 * Threat Feed Ticker
 * Scrolling threat intelligence ticker at the bottom of the dashboard
 */

(function() {
  'use strict';

  var SEVERITY_COLORS = {
    critical: '#ff4444',
    high: '#ff8c00',
    medium: '#ffff00',
    low: '#00ff00'
  };

  var SEPARATOR = ' \u2022 '; // bullet
  var tickerBar = null;
  var tickerContent = null;
  var styleEl = null;

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - Raw string
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Create the ticker DOM elements and inject CSS
   */
  function createTickerDOM() {
    // Inject keyframes and ticker styles
    styleEl = document.createElement('style');
    styleEl.textContent =
      '@keyframes ticker-scroll {' +
        '0% { transform: translateX(0); }' +
        '100% { transform: translateX(-50%); }' +
      '}' +
      '#threat-ticker {' +
        'position: absolute;' +
        'bottom: 0;' +
        'left: 0;' +
        'width: 100%;' +
        'height: 40px;' +
        'background: rgba(0, 0, 0, 0.95);' +
        'border-top: 2px solid #00d9ff;' +
        'box-shadow: 0 -2px 15px rgba(0, 217, 255, 0.3);' +
        'z-index: 15;' +
        'overflow: hidden;' +
        'display: none;' +
        'font-family: "Courier New", monospace;' +
        'font-size: 16px;' +
        'line-height: 40px;' +
        'white-space: nowrap;' +
      '}' +
      '#threat-ticker-content {' +
        'display: inline-block;' +
        'padding-left: 100%;' +
        'white-space: nowrap;' +
      '}' +
      '.ticker-item {' +
        'display: inline;' +
      '}' +
      '.ticker-separator {' +
        'color: #00d9ff;' +
        'margin: 0 12px;' +
      '}' +
      '@media (min-width: 1920px) {' +
        '#threat-ticker { height: 48px; font-size: 20px; line-height: 48px; }' +
      '}' +
      '@media (min-width: 3840px) {' +
        '#threat-ticker { height: 60px; font-size: 26px; line-height: 60px; }' +
      '}';
    document.head.appendChild(styleEl);

    // Create ticker bar
    tickerBar = document.createElement('div');
    tickerBar.id = 'threat-ticker';

    // Create scrolling content wrapper
    tickerContent = document.createElement('div');
    tickerContent.id = 'threat-ticker-content';
    tickerBar.appendChild(tickerContent);

    document.body.appendChild(tickerBar);
  }

  /**
   * Build ticker HTML from items (duplicated for seamless loop)
   * @param {Array} items - Feed items
   * @returns {string} HTML string
   */
  function buildTickerHtml(items) {
    if (!items || items.length === 0) return '';

    var parts = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var color = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.medium;
      var sevLabel = (item.severity || 'medium').toUpperCase();
      parts.push(
        '<span class="ticker-item">' +
          '<span style="color:' + color + '; text-shadow: 0 0 8px ' + color + ';">[' + escapeHtml(sevLabel) + ']</span> ' +
          '<span style="color: #ccc;">' + escapeHtml(item.text) + '</span>' +
          (item.source ? ' <span style="color: #666;">(' + escapeHtml(item.source) + ')</span>' : '') +
        '</span>'
      );
    }

    var single = parts.join('<span class="ticker-separator">' + SEPARATOR + '</span>');
    // Duplicate content for seamless looping
    return single + '<span class="ticker-separator">' + SEPARATOR + '</span>' + single;
  }

  /**
   * Update ticker content and animation
   * @param {Array} items - Feed items
   */
  function updateTicker(items) {
    if (!tickerBar || !tickerContent) return;

    if (!items || items.length === 0) {
      tickerBar.style.display = 'none';
      tickerContent.style.animation = 'none';
      return;
    }

    tickerContent.innerHTML = buildTickerHtml(items);
    tickerBar.style.display = 'block';

    // Scale animation duration with content length (20s–120s)
    var totalChars = items.reduce(function(sum, item) { return sum + (item.text || '').length; }, 0);
    var duration = Math.min(120, Math.max(20, totalChars * 0.15));

    tickerContent.style.animation = 'ticker-scroll ' + duration + 's linear infinite';
  }

  /**
   * Initialize ticker: create DOM and fetch initial data
   */
  function initThreatTicker() {
    createTickerDOM();

    // Fetch initial feed items
    fetch('/api/threat-feed')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && Array.isArray(data.items)) {
          updateTicker(data.items);
        }
      })
      .catch(function(err) {
        console.error('[ThreatTicker] Error fetching feed:', err);
      });
  }

  // Expose to global scope
  window.initThreatTicker = initThreatTicker;
  window.updateThreatTicker = updateTicker;
})();

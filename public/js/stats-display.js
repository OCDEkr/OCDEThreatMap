/**
 * Browser-side statistics display module
 *
 * Creates and manages the DOM-based statistics panel for NOC displays.
 * Features:
 * - Large fonts readable from 20+ feet
 * - High-contrast colors (green on black)
 * - Pulse animation on updates
 * - NOC-optimized layout
 *
 * Uses IIFE pattern to expose functions to window scope for browser use.
 */
(function() {
  'use strict';

  let statsPanel = null;

  /**
   * Create the statistics panel and append to document body
   * @returns {HTMLElement} The created stats panel element
   */
  window.createStatsPanel = function() {
    // Prevent multiple panels
    if (statsPanel) {
      console.warn('Stats panel already exists');
      return statsPanel;
    }

    // Create panel container
    statsPanel = document.createElement('div');
    statsPanel.id = 'stats-panel';
    statsPanel.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 24px;
      border: 2px solid #00ff00;
      padding: 20px;
      min-width: 300px;
      z-index: 10;
      border-radius: 5px;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
    `;

    // Add HTML structure with large primary metric
    statsPanel.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px; font-weight: bold; text-shadow: 0 0 10px #00ff00;">
        ATTACKS: <span id="total-attacks">0</span>
      </div>
      <div style="font-size: 28px; margin-bottom: 10px;">
        APM: <span id="apm">0</span>
      </div>
      <div style="font-size: 18px; color: #00cc00; margin-top: 15px; border-top: 1px solid #00ff00; padding-top: 10px;">
        <div>Last update: <span id="last-update">--:--:--</span></div>
      </div>
    `;

    document.body.appendChild(statsPanel);
    console.log('Stats panel created');

    return statsPanel;
  };

  /**
   * Update the statistics display with new metrics
   * @param {Object} metrics - Metrics object from stats-metrics.js
   * @param {number} metrics.totalAttacks - Total attacks in window
   * @param {number} metrics.attacksPerMinute - Attacks per minute
   * @param {number} metrics.lastUpdated - Timestamp of last update
   */
  window.updateStatsDisplay = function(metrics) {
    if (!statsPanel) {
      console.warn('Stats panel not created yet, call createStatsPanel() first');
      return;
    }

    const totalElement = document.getElementById('total-attacks');
    const apmElement = document.getElementById('apm');
    const lastUpdateElement = document.getElementById('last-update');

    if (totalElement) {
      totalElement.textContent = metrics.totalAttacks;

      // Add pulse animation on update
      totalElement.style.animation = 'none';
      setTimeout(() => {
        totalElement.style.animation = 'pulse 0.3s';
      }, 10);
    }

    if (apmElement) {
      apmElement.textContent = metrics.attacksPerMinute;
    }

    if (lastUpdateElement) {
      const now = new Date(metrics.lastUpdated);
      lastUpdateElement.textContent = now.toLocaleTimeString();
    }
  };

  /**
   * Remove the statistics panel from the DOM
   */
  window.removeStatsPanel = function() {
    if (statsPanel) {
      statsPanel.remove();
      statsPanel = null;
      console.log('Stats panel removed');
    }
  };

  // Add pulse animation CSS to document head
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 1; text-shadow: 0 0 10px #00ff00; transform: scale(1); }
      50% { opacity: 0.8; text-shadow: 0 0 20px #00ff00; transform: scale(1.05); }
      100% { opacity: 1; text-shadow: 0 0 10px #00ff00; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);

  console.log('Stats display module initialized');
})();

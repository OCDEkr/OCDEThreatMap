/**
 * Browser-side statistics tracking module
 *
 * Tracks attack events in a sliding time window and calculates metrics:
 * - Total attacks in current window
 * - Attacks per minute (APM)
 *
 * Uses IIFE pattern to expose functions to window scope for browser use.
 */
(function() {
  'use strict';

  let timestamps = [];
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes sliding window

  /**
   * Update metrics when a new attack event arrives
   * @param {Object} attackEvent - The attack event from WebSocket
   */
  window.updateMetrics = function(attackEvent) {
    const now = Date.now();
    timestamps.push(now);

    // Cleanup old timestamps outside the window
    timestamps = timestamps.filter(ts => now - ts < MAX_AGE);

    // Update display immediately
    if (window.updateStatsDisplay) {
      window.updateStatsDisplay(window.getMetrics());
    }
  };

  /**
   * Get current metrics for display
   * @returns {Object} Metrics object with totalAttacks, attacksPerMinute, lastUpdated
   */
  window.getMetrics = function() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Filter for last minute to calculate APM
    const recentAttacks = timestamps.filter(ts => ts > oneMinuteAgo);

    return {
      totalAttacks: recentAttacks.length,
      attacksPerMinute: recentAttacks.length,
      lastUpdated: now
    };
  };

  /**
   * Clear all metrics (for testing or reset)
   */
  window.clearMetrics = function() {
    timestamps = [];
    console.log('Metrics cleared');
  };

  /**
   * Get raw timestamp array (for debugging)
   * @returns {Array} Array of timestamps
   */
  window.getTimestamps = function() {
    return [...timestamps];
  };

  console.log('Stats metrics module initialized');
})();

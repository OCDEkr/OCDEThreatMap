/**
 * Arc Animation Module
 * Manages attack arc lifecycle with automatic cleanup
 * Pattern: IIFE exposing window.addAttackArc and window.clearArcs
 */

(function() {
  'use strict';

  // Arc storage and configuration
  let arcs = [];
  const MAX_ARCS = 10;               // Maximum concurrent arcs (matches custom-arcs.js)
  const ARC_LIFETIME = 2000;         // Arc lifetime in milliseconds (matches custom arc duration)

  // Threat-type color mapping
  const THREAT_COLORS = {
    malware: ['rgba(255, 0, 0, 0)', 'rgba(255, 0, 0, 1)'],        // Red
    intrusion: ['rgba(255, 140, 0, 0)', 'rgba(255, 140, 0, 1)'],  // Dark orange
    ddos: ['rgba(138, 43, 226, 0)', 'rgba(138, 43, 226, 1)'],     // Purple
    deny: ['rgba(255, 165, 0, 0)', 'rgba(255, 165, 0, 1)'],       // Orange (default)
    default: ['rgba(255, 165, 0, 0)', 'rgba(255, 165, 0, 1)']     // Orange fallback
  };

  // OCDE location (Orange County, CA)
  const OCDE_LAT = 33.7490;
  const OCDE_LNG = -117.8705;

  // IP-to-country fallback mapping for common public IPs
  const IP_TO_COUNTRY = {
    '1.1.1.1': 'US',        // Cloudflare DNS
    '8.8.8.8': 'US',        // Google DNS
    '8.8.4.4': 'US',        // Google DNS alt
    '1.0.0.1': 'US',        // Cloudflare DNS alt
    '208.67.222.222': 'US', // OpenDNS
    '208.67.220.220': 'US'  // OpenDNS alt
  };

  /**
   * Add attack arc to globe using custom Three.js arcs
   * @param {Object} attackEvent - Attack event with geo data
   * @param {Object} attackEvent.geo - Geolocation data
   * @param {string} attackEvent.geo.country_code - ISO 3166-1 alpha-2 country code
   * @param {string} [attackEvent.sourceIP] - Source IP address (for logging)
   * @param {string} [attackEvent.threatType] - Threat type (for logging)
   */
  window.addAttackArc = function(attackEvent) {
    // Check if custom arc system is available
    if (typeof window.addCustomArc !== 'function') {
      console.warn('Custom arc system not loaded - cannot add arc');
      return;
    }

    // Validate attack event structure
    if (!attackEvent) {
      console.warn('Invalid attack event - missing event data');
      return;
    }

    // Get country code from geo data or fallback to IP lookup
    let countryCode = null;

    if (attackEvent.geo) {
      countryCode = attackEvent.geo.country_code || attackEvent.geo.countryCode || attackEvent.geo.country;
    }

    // Fallback: Try IP-to-country mapping for common IPs
    if (!countryCode && attackEvent.sourceIP) {
      countryCode = IP_TO_COUNTRY[attackEvent.sourceIP];
      if (countryCode) {
        console.log('Using IP-to-country fallback for', attackEvent.sourceIP, '→', countryCode);
      }
    }

    // If still no country code, skip arc
    if (!countryCode) {
      console.warn('Attack event missing country_code and no fallback available for IP:', attackEvent.sourceIP);
      return;
    }

    const sourceCoords = window.getCountryCoordinates(countryCode);
    if (!sourceCoords) {
      console.warn('Unknown country code:', countryCode, '- skipping arc');
      return;
    }

    // Get threat type
    const threatType = (attackEvent.attack && attackEvent.attack.threat_type) ||
                       attackEvent.threatType ||
                       'default';

    // Create arc data for custom arc system
    const arcData = {
      startLat: sourceCoords[0],
      startLng: sourceCoords[1],
      endLat: OCDE_LAT,
      endLng: OCDE_LNG,
      threatType: threatType,
      sourceIP: attackEvent.sourceIP || (attackEvent.attack && attackEvent.attack.source_ip),
      countryCode: countryCode
    };

    // Add to custom arc system (independent animation)
    window.addCustomArc(arcData);

    // Track for compatibility (but don't use Globe.GL's arc system)
    arcs.push({
      id: `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _countryCode: countryCode,
      _threatType: threatType,
      _timestamp: Date.now()
    });

    // Manage arc limit for performance
    if (arcs.length >= MAX_ARCS) {
      arcs.shift();
    }

    // Auto-cleanup tracking array
    setTimeout(() => {
      if (arcs.length > 0) {
        arcs.shift();
      }
    }, ARC_LIFETIME);
  };

  /**
   * Clear all arcs from globe (both custom and Globe.GL arcs)
   * Useful for reset/testing scenarios
   */
  window.clearArcs = function() {
    arcs = [];

    // Clear custom arcs if available
    if (typeof window.clearCustomArcs === 'function') {
      window.clearCustomArcs();
    }

    // Clear Globe.GL arcs (legacy support)
    const globe = window.getGlobe();
    if (globe) {
      globe.arcsData([]);
    }

    console.log('All arcs cleared');
  };

  /**
   * Get current arc count
   * @returns {number} Number of active arcs
   */
  window.getArcCount = function() {
    return arcs.length;
  };

  /**
   * Get arc configuration
   * @returns {Object} Arc configuration settings
   */
  window.getArcConfig = function() {
    return {
      maxArcs: MAX_ARCS,
      lifetime: ARC_LIFETIME,
      destination: { lat: OCDE_LAT, lng: OCDE_LNG },
      threatColors: THREAT_COLORS
    };
  };

  console.log('Arc module loaded - Max:', MAX_ARCS, 'arcs, Lifetime:', ARC_LIFETIME + 'ms');

})();

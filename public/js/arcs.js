/**
 * Arc Animation Module
 * Manages attack arc lifecycle with automatic cleanup
 * Pattern: IIFE exposing window.addAttackArc and window.clearArcs
 */

(function() {
  'use strict';

  // Arc storage and configuration
  let arcs = [];
  const MAX_ARCS = 500;              // Maximum concurrent arcs for performance
  const ARC_LIFETIME = 2000;         // Arc lifetime in milliseconds (2 seconds)
  const ARC_COLOR_START = 'rgba(255, 165, 0, 0)';   // Orange transparent (origin)
  const ARC_COLOR_END = 'rgba(255, 165, 0, 1)';     // Orange opaque (destination)

  // OCDE location (Orange County, CA)
  const OCDE_LAT = 33.7490;
  const OCDE_LNG = -117.8705;

  /**
   * Add attack arc to globe
   * @param {Object} attackEvent - Attack event with geo data
   * @param {Object} attackEvent.geo - Geolocation data
   * @param {string} attackEvent.geo.country_code - ISO 3166-1 alpha-2 country code
   * @param {string} [attackEvent.sourceIP] - Source IP address (for logging)
   * @param {string} [attackEvent.threatType] - Threat type (for logging)
   */
  window.addAttackArc = function(attackEvent) {
    // Get globe instance
    const globe = window.getGlobe();
    if (!globe) {
      console.warn('Globe not initialized - cannot add arc');
      return;
    }

    // Validate attack event structure
    if (!attackEvent || !attackEvent.geo) {
      console.warn('Invalid attack event - missing geo data');
      return;
    }

    // Get country coordinates
    const countryCode = attackEvent.geo.country_code || attackEvent.geo.countryCode;
    if (!countryCode) {
      console.warn('Attack event missing country_code');
      return;
    }

    const sourceCoords = window.getCountryCoordinates(countryCode);
    if (!sourceCoords) {
      console.warn('Unknown country code:', countryCode, '- skipping arc');
      return;
    }

    // Create arc object
    const arc = {
      startLat: sourceCoords[0],
      startLng: sourceCoords[1],
      endLat: OCDE_LAT,
      endLng: OCDE_LNG,
      color: [ARC_COLOR_START, ARC_COLOR_END],
      // Metadata for debugging
      _countryCode: countryCode,
      _sourceIP: attackEvent.sourceIP,
      _timestamp: Date.now()
    };

    // Manage arc limit for performance
    if (arcs.length >= MAX_ARCS) {
      // Remove oldest arc
      const removed = arcs.shift();
      console.debug('Max arcs reached - removed oldest arc from', removed._countryCode);
    }

    // Add arc to array
    arcs.push(arc);

    // Update globe with new arc data
    globe.arcsData(arcs);

    // Log arc creation
    console.debug('Arc added:', countryCode, '->', 'OCDE',
                  `(${arcs.length}/${MAX_ARCS} active)`);

    // Schedule automatic removal after animation completes
    setTimeout(() => {
      const index = arcs.indexOf(arc);
      if (index > -1) {
        arcs.splice(index, 1);
        // Update globe (create new array to trigger update)
        globe.arcsData([...arcs]);
        console.debug('Arc removed:', arc._countryCode,
                      `(${arcs.length}/${MAX_ARCS} active)`);
      }
    }, ARC_LIFETIME);
  };

  /**
   * Clear all arcs from globe
   * Useful for reset/testing scenarios
   */
  window.clearArcs = function() {
    arcs = [];
    const globe = window.getGlobe();
    if (globe) {
      globe.arcsData([]);
      console.log('All arcs cleared');
    }
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
      colorStart: ARC_COLOR_START,
      colorEnd: ARC_COLOR_END
    };
  };

  console.log('Arc animation module loaded - Max arcs:', MAX_ARCS, 'Lifetime:', ARC_LIFETIME + 'ms');

})();

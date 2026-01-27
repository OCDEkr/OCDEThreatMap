/**
 * Globe Visualization Module
 * Browser-side globe initialization and management using Globe.GL
 * Pattern: IIFE exposing window.initGlobe and window.getGlobe
 */

(function() {
  'use strict';

  let globeInstance = null;

  /**
   * Initialize 3D globe with performance settings
   * @param {string} containerId - DOM element ID for globe container
   * @returns {Object} Globe.GL instance
   */
  window.initGlobe = function(containerId) {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error('Globe container not found:', containerId);
      return null;
    }

    // Check if Globe is available (loaded from CDN)
    if (typeof Globe === 'undefined') {
      console.error('Globe.GL library not loaded. Include from CDN first.');
      return null;
    }

    // Initialize Globe.GL instance
    globeInstance = Globe()(container)
      // Earth textures from globe.gl CDN
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      // Atmosphere rendering
      .showAtmosphere(true)
      .atmosphereColor('lightskyblue')
      .atmosphereAltitude(0.15)
      // Default view centered on Orange County, CA
      .pointOfView({
        lat: 33.7490,
        lng: -117.8705,
        altitude: 2.5
      })
      // Performance optimizations
      .pointsMerge(true)  // Merge point meshes for performance
      .arcsTransitionDuration(0)  // No transition animation overhead
      .arcDashAnimateTime(1000);  // 1 second arc animation duration

    // Configure renderer for performance
    const renderer = globeInstance.renderer();
    renderer.setPixelRatio(1.5); // Balance quality/performance (avoid full devicePixelRatio)
    renderer.shadowMap.enabled = false; // Shadows are expensive

    // Set initial arc data (empty)
    globeInstance.arcsData([]);

    console.log('Globe initialized successfully');

    return globeInstance;
  };

  /**
   * Get the current globe instance
   * @returns {Object|null} Globe.GL instance or null if not initialized
   */
  window.getGlobe = function() {
    return globeInstance;
  };

  /**
   * Reset globe to default view (Orange County)
   */
  window.resetGlobeView = function() {
    if (globeInstance) {
      globeInstance.pointOfView({
        lat: 33.7490,
        lng: -117.8705,
        altitude: 2.5
      }, 1000); // 1 second animation
    }
  };

})();

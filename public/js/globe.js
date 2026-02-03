/**
 * Globe Visualization Module
 * Browser-side globe initialization and management using Globe.GL
 * Pattern: IIFE exposing window.initGlobe and window.getGlobe
 */

(function() {
  'use strict';

  let globeInstance = null;
  let usStatesData = null;  // Cache US states data

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

    // Initialize Globe.GL instance with hi-tech digital style
    globeInstance = Globe()(container)
      // Use dark earth texture for base
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      // Apply blue ocean with dark landmasses
      .globeMaterial(new THREE.MeshPhongMaterial({
        color: 0x0d47a1,          // Deep blue for oceans
        emissive: 0x1976d2,       // Lighter blue glow for oceans
        emissiveIntensity: 0.2,   // Subtle blue ocean glow
        shininess: 0,             // No shininess - removes specular dot
        transparent: false,
        specular: 0x000000        // No specular highlights - black
      }))
      // Atmosphere rendering - bright cyan/blue
      .showAtmosphere(true)
      .atmosphereColor('#00ffff')
      .atmosphereAltitude(0.25)
      // Default view centered on Orange County, CA
      .pointOfView({
        lat: 33.7490,
        lng: -117.8705,
        altitude: 2.5
      })
      // Performance optimizations
      .pointsMerge(true)  // Merge point meshes for performance
      .arcsTransitionDuration(0)  // No fade-in transition - arc draws immediately
      // Arc appearance - animated traveling arcs
      .arcColor(d => d.color)  // Use color array from arc data
      .arcStroke(d => d.stroke || 0.8)  // Thicker solid arcs
      .arcDashLength(0.4)      // Length of the visible arc segment (40% of arc)
      .arcDashGap(0.6)         // Gap after the arc (60% - creates traveling effect)
      .arcDashInitialGap(0)    // Start from origin
      .arcDashAnimateTime(1500)  // 1.5 second travel from origin to destination
      // Arc trajectory
      .arcAltitude(0.3)        // Arc height for trajectory
      .arcAltitudeAutoScale(0.5)  // Scale altitude based on distance

    // Load and add country borders
    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(countries => {
        globeInstance
          .polygonsData(countries.features)
          .polygonAltitude(0.01)
          .polygonCapColor(() => 'rgba(0, 100, 200, 0.05)')  // Very transparent country fill
          .polygonSideColor(() => 'rgba(0, 255, 255, 0.15)')  // Subtle cyan border glow
          .polygonStrokeColor(() => '#00ffff')  // Bright cyan borders
          .polygonLabel(({ properties: d }) => `
            <div style="background: rgba(0, 0, 0, 0.9); padding: 3px 6px; border: 1px solid #00ffff; border-radius: 3px;">
              <b>${d.ADMIN || d.NAME || ''}</b>
            </div>
          `);
        console.log('Country borders loaded successfully');

        // Load US state borders after countries are loaded
        loadUSStateBorders();
      })
      .catch(err => {
        console.warn('Failed to load country borders:', err);
      });

    // Configure renderer for performance
    const renderer = globeInstance.renderer();
    renderer.setPixelRatio(1.5); // Balance quality/performance (avoid full devicePixelRatio)
    renderer.shadowMap.enabled = false; // Shadows are expensive
    renderer.setClearColor(0x000000, 1); // Set background to pure black

    // Access the Three.js scene and force background to pure black
    const scene = globeInstance.scene();
    if (scene) {
      scene.background = new THREE.Color(0x000000); // Pure black background
    }

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
   * Toggle between globe view and flat map view
   * @returns {string} Current view mode ('globe' or 'flat')
   */
  let currentViewMode = 'globe';  // Track view state

  window.toggleView = function() {
    if (currentViewMode === 'globe') {
      // Switch to custom flat map
      // Hide globe
      document.getElementById('globe').style.display = 'none';

      // Show flat map canvas
      if (!window.initFlatMap || !window.initFlatMap()) {
        console.error('Failed to initialize flat map');
        document.getElementById('globe').style.display = 'block';
        return 'globe';
      }

      window.startFlatMap();
      console.log('Switched to custom flat map with blue oceans');
      currentViewMode = 'flat';
      return 'flat';
    } else {
      // Switch back to 3D globe view
      // Hide flat map
      window.stopFlatMap();

      // Show globe
      document.getElementById('globe').style.display = 'block';

      console.log('Switched back to globe view');
      currentViewMode = 'globe';
      return 'globe';
    }
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

  /**
   * Internal function to load US state borders
   * Uses same US Atlas TopoJSON source as D3 flat map
   */
  function loadUSStateBorders() {
    if (!globeInstance) {
      console.error('Globe not initialized');
      return;
    }

    // If already loaded, skip
    if (usStatesData) {
      console.log('US states already loaded');
      return;
    }

    // Check if topojson library is available
    if (typeof topojson === 'undefined') {
      console.error('TopoJSON library not loaded. US states cannot be displayed.');
      return;
    }

    // Load US states TopoJSON (same source as D3 flat map)
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(res => res.json())
      .then(us => {
        // Convert TopoJSON to GeoJSON
        const states = topojson.feature(us, us.objects.states);
        usStatesData = states;

        // Use polygonsData to render state boundaries
        // Extract existing country data first to avoid overwriting
        const existingPolygons = globeInstance.polygonsData();

        // Add state features with distinct styling
        globeInstance
          .polygonsData([...existingPolygons, ...states.features.map(f => ({ ...f, isState: true }))])
          .polygonAltitude(d => d.isState ? 0.012 : 0.01)
          .polygonCapColor(d => d.isState ? 'rgba(255, 165, 0, 0.03)' : 'rgba(0, 100, 200, 0.05)')
          .polygonSideColor(d => d.isState ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 255, 255, 0.15)')
          .polygonStrokeColor(d => d.isState ? '#ffa500' : '#00ffff')
          .polygonLabel(({ properties: d, isState }) => {
            if (isState) {
              return `
                <div style="background: rgba(0, 0, 0, 0.9); padding: 3px 6px; border: 1px solid #ffa500; border-radius: 3px;">
                  <b>${d.name || ''}</b>
                </div>
              `;
            }
            return `
              <div style="background: rgba(0, 0, 0, 0.9); padding: 3px 6px; border: 1px solid #00ffff; border-radius: 3px;">
                <b>${d.ADMIN || d.NAME || ''}</b>
              </div>
            `;
          });

        console.log('US state borders loaded successfully:', states.features.length, 'states');
      })
      .catch(err => {
        console.warn('Failed to load US states:', err);
      });
  }

  /**
   * Show US state borders (can be called manually or when zooming to US)
   */
  window.showUSStates = function() {
    loadUSStateBorders();
  };

  /**
   * Hide US state borders
   */
  window.hideUSStates = function() {
    if (!globeInstance) {
      console.error('Globe not initialized');
      return;
    }

    // Clear the hexPolygons layer
    globeInstance.hexPolygonsData([]);
    usStatesData = null;
    console.log('US state borders hidden');
  };

  /**
   * Focus on United States with state borders
   */
  window.focusOnUS = function() {
    if (!globeInstance) {
      console.error('Globe not initialized');
      return;
    }

    // Center on continental US
    globeInstance.pointOfView({
      lat: 39.8283,  // Center of US
      lng: -98.5795,
      altitude: 1.5  // Closer zoom for US view
    }, 1000);

    // Load state borders
    setTimeout(() => {
      showUSStates();
    }, 500);  // Load states after view transition starts
  };

  /**
   * Auto-rotate globe counter-clockwise starting from US
   */
  let rotationAnimationId = null;
  let isRotating = false;

  window.startGlobeRotation = function() {
    if (!globeInstance) {
      console.error('Globe not initialized');
      return;
    }

    if (isRotating) {
      console.log('Globe rotation already active');
      return;
    }

    // First, center on US
    globeInstance.pointOfView({
      lat: 39.8283,    // Center of US
      lng: -98.5795,
      altitude: 2.5
    }, 1000);

    // Start rotation after centering animation
    setTimeout(() => {
      isRotating = true;
      // Calculate rotation speed: 360 degrees / 30 seconds = 12 degrees per second
      // At 60fps: 12 degrees / 60 frames = 0.2 degrees per frame
      const rotationSpeed = 0.2; // degrees per frame (360° in 30 seconds at 60fps)

      function animate() {
        if (!isRotating) return;

        const currentView = globeInstance.pointOfView();
        // Subtract rotationSpeed for counter-clockwise rotation
        let newLng = currentView.lng - rotationSpeed;
        // Wrap around at -180/180 boundary
        if (newLng < -180) newLng += 360;

        globeInstance.pointOfView({
          lat: currentView.lat,
          lng: newLng,
          altitude: currentView.altitude
        }, 0); // No transition for smooth continuous rotation

        rotationAnimationId = requestAnimationFrame(animate);
      }

      animate();
      console.log('Globe rotation started (counter-clockwise) - one revolution per 30 seconds');
    }, 1000);
  };

  window.stopGlobeRotation = function() {
    if (!isRotating) {
      console.log('Globe rotation not active');
      return;
    }

    isRotating = false;
    if (rotationAnimationId) {
      cancelAnimationFrame(rotationAnimationId);
      rotationAnimationId = null;
    }
    console.log('Globe rotation stopped');
  };

  window.isGlobeRotating = function() {
    return isRotating;
  };

})();

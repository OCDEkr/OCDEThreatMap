/**
 * D3-based Flat Map Visualization
 * Uses D3.js and GeoJSON for accurate world map rendering
 */

(function() {
  'use strict';

  let mapInitialized = false;
  let animationId = null;
  let svg = null;
  let projection = null;
  let path = null;
  let arcsGroup = null;
  let statesGroup = null;
  let mapData = {
    arcs: []
  };

  /**
   * Initialize D3 flat map
   */
  window.initD3FlatMap = function() {
    const container = document.getElementById('flat-map-container');
    if (!container) {
      // Create container if it doesn't exist
      const mapContainer = document.createElement('div');
      mapContainer.id = 'flat-map-container';
      mapContainer.style.cssText = 'display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background: #000000;';
      document.body.appendChild(mapContainer);
    }

    // Clear any existing SVG
    d3.select('#flat-map-container').selectAll('*').remove();

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create SVG
    svg = d3.select('#flat-map-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', '#000000'); // Black ocean

    // Create projection (Equirectangular for full world view without cutoff)
    projection = d3.geoEquirectangular()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, height / 2])
      .center([0, 0]);  // Center at prime meridian and equator

    path = d3.geoPath(projection);

    // Create groups for different layers
    const mapGroup = svg.append('g').attr('class', 'map-group');
    statesGroup = svg.append('g').attr('class', 'states-group');
    arcsGroup = svg.append('g').attr('class', 'arcs-group');

    // Load world map data from CDN
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(function(world) {
        // Convert TopoJSON to GeoJSON
        const countries = topojson.feature(world, world.objects.countries);

        // Draw countries
        mapGroup.selectAll('path')
          .data(countries.features)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('fill', '#001a33')  // Dark landmasses
          .attr('stroke', '#00ffff') // Cyan borders
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.9);

        console.log('D3 flat map initialized with', countries.features.length, 'countries');

        // Load US states data after countries are loaded
        loadUSStates();

        mapInitialized = true;
      })
      .catch(function(error) {
        console.error('Error loading world map data:', error);
        // Fallback to simple continent shapes if CDN fails
        drawSimpleContinents();
      });

    return true;
  };

  /**
   * Load and display US state boundaries
   */
  function loadUSStates() {
    // Load US states TopoJSON data
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(function(us) {
        // Convert TopoJSON to GeoJSON
        const states = topojson.feature(us, us.objects.states);

        // Draw state boundaries
        statesGroup.selectAll('path')
          .data(states.features)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')  // No fill, just borders
          .attr('stroke', '#00ffff')  // Cyan state borders
          .attr('stroke-width', 0.3)  // Thinner than country borders
          .attr('stroke-opacity', 0.5)  // Semi-transparent
          .attr('class', 'us-state');

        console.log('US states loaded:', states.features.length, 'states');
      })
      .catch(function(error) {
        console.warn('Could not load US states data:', error);
        // States are optional, so just warn rather than error
      });
  }

  /**
   * Fallback: Draw simplified continent shapes
   */
  function drawSimpleContinents() {
    const continents = [
      // North America
      { name: 'North America', points: [[-130, 70], [-130, 25], [-60, 25], [-60, 70], [-130, 70]] },
      // South America
      { name: 'South America', points: [[-80, 10], [-80, -55], [-35, -55], [-35, 10], [-80, 10]] },
      // Africa
      { name: 'Africa', points: [[-20, 35], [-20, -35], [50, -35], [50, 35], [-20, 35]] },
      // Europe
      { name: 'Europe', points: [[-10, 70], [-10, 35], [40, 35], [40, 70], [-10, 70]] },
      // Asia
      { name: 'Asia', points: [[40, 70], [40, 0], [150, 0], [150, 70], [40, 70]] },
      // Australia
      { name: 'Australia', points: [[110, -10], [110, -45], [160, -45], [160, -10], [110, -10]] }
    ];

    const mapGroup = svg.append('g').attr('class', 'map-group');

    continents.forEach(continent => {
      const coordinates = continent.points.map(p => projection(p));

      mapGroup.append('path')
        .attr('d', d3.line()(coordinates) + 'Z')
        .attr('fill', '#001a33')
        .attr('stroke', '#00ffff')
        .attr('stroke-width', 1)
        .attr('opacity', 0.9);
    });

    mapInitialized = true;
  }

  /**
   * Add attack arc to the map with country flash
   */
  window.addD3Arc = function(srcLat, srcLng, dstLat, dstLng, color = ['rgba(255, 0, 0, 0.8)', 'rgba(255, 100, 0, 0.8)']) {
    if (!mapInitialized || !arcsGroup) return;

    // Project coordinates
    const source = projection([srcLng, srcLat]);
    const target = projection([dstLng, dstLat]);

    // Phase 1: Create country flash at source location (500ms)
    const flashDuration = 500;
    const arcDelay = 300;

    // Extract solid color from rgba string for flash
    const flashColor = color[0].replace('rgba', 'rgb').replace(/,\s*[\d.]+\)/, ')');

    // Create pulsing circle at source
    const flash = arcsGroup.append('circle')
      .attr('cx', source[0])
      .attr('cy', source[1])
      .attr('r', 5)
      .attr('fill', flashColor)
      .attr('opacity', 0.9);

    // Animate flash with pulsing effect
    flash.transition()
      .duration(flashDuration / 4)
      .attr('r', 10)
      .attr('opacity', 0.7)
      .transition()
      .duration(flashDuration / 4)
      .attr('r', 7)
      .attr('opacity', 0.9)
      .transition()
      .duration(flashDuration / 4)
      .attr('r', 12)
      .attr('opacity', 0.6)
      .transition()
      .duration(flashDuration / 4)
      .attr('r', 8)
      .attr('opacity', 0.5)
      .on('end', function() {
        // Phase 2: Fade out flash during delay (300ms)
        d3.select(this)
          .transition()
          .duration(arcDelay)
          .attr('opacity', 0)
          .remove();
      });

    // Phase 3: Show arc after flash + delay (800ms total)
    setTimeout(function() {
      drawArc(source, target, color);
    }, flashDuration + arcDelay);
  };

  /**
   * Draw the arc animation (extracted from addD3Arc for phased animation)
   */
  function drawArc(source, target, color) {
    if (!arcsGroup) return;

    // Create arc path using quadratic curve
    const dx = target[0] - source[0];
    const dy = target[1] - source[1];
    const dr = Math.sqrt(dx * dx + dy * dy);
    const sweep = dx > 0 ? 1 : 0;

    // Arc path with curve
    const arcPath = `M${source[0]},${source[1]} A${dr},${dr} 0 0,${sweep} ${target[0]},${target[1]}`;

    // Create gradient for this arc
    const gradientId = 'arc-gradient-' + Date.now() + '-' + Math.random();
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', color[0]);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', color[1] || color[0]);

    // Draw arc with animation
    const arc = arcsGroup.append('path')
      .attr('d', arcPath)
      .attr('fill', 'none')
      .attr('stroke', `url(#${gradientId})`)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0);

    // Animate arc
    arc.transition()
      .duration(500)
      .attr('opacity', 0.8)
      .transition()
      .duration(2000)
      .attr('opacity', 0.3)
      .transition()
      .duration(1000)
      .attr('opacity', 0)
      .remove();

    // Draw impact point
    const impact = arcsGroup.append('circle')
      .attr('cx', target[0])
      .attr('cy', target[1])
      .attr('r', 2)
      .attr('fill', color[1] || color[0])
      .attr('opacity', 0);

    impact.transition()
      .duration(500)
      .attr('r', 8)
      .attr('opacity', 0.8)
      .transition()
      .duration(1000)
      .attr('r', 15)
      .attr('opacity', 0)
      .remove();
  }

  /**
   * Start flat map animation
   */
  window.startD3FlatMap = function() {
    const container = document.getElementById('flat-map-container');
    if (container) {
      container.style.display = 'block';
    }

    if (!mapInitialized) {
      window.initD3FlatMap();
    }

    // Handle resize
    window.addEventListener('resize', handleResize);

    console.log('D3 flat map started');
  };

  /**
   * Stop flat map animation
   */
  window.stopD3FlatMap = function() {
    const container = document.getElementById('flat-map-container');
    if (container) {
      container.style.display = 'none';
    }

    // Remove resize listener
    window.removeEventListener('resize', handleResize);

    console.log('D3 flat map stopped');
  };

  /**
   * Handle window resize
   */
  function handleResize() {
    if (!mapInitialized) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update SVG size
    svg.attr('width', width).attr('height', height);

    // Update projection
    projection
      .scale(width / 2 / Math.PI)
      .translate([width / 2, height / 2]);

    // Redraw map paths
    svg.selectAll('.map-group path')
      .attr('d', path);
  }

  /**
   * Clear all arcs from the map
   */
  window.clearD3Arcs = function() {
    if (arcsGroup) {
      arcsGroup.selectAll('*').remove();
    }
  };

})();
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

  // Country/region-based color mapping (matching custom-arcs.js)
  // Colors chosen for NOC visibility and regional grouping
  const COUNTRY_COLORS = {
    // Asia - Warm colors
    CN: '#ff0000',    // China - Red
    RU: '#ff3300',    // Russia - Red-Orange
    KP: '#cc0000',    // North Korea - Dark Red
    IR: '#ff6600',    // Iran - Orange
    IN: '#ff9900',    // India - Gold
    PK: '#ffcc00',    // Pakistan - Yellow-Gold
    VN: '#ff6666',    // Vietnam - Light Red
    KR: '#ff9966',    // South Korea - Peach
    JP: '#ffcccc',    // Japan - Pink
    ID: '#ff8800',    // Indonesia - Dark Orange
    TH: '#ffaa00',    // Thailand - Amber
    MY: '#ffbb33',    // Malaysia - Gold-Orange
    PH: '#ffcc66',    // Philippines - Light Gold
    BD: '#ff7744',    // Bangladesh - Coral

    // Europe - Cool colors
    DE: '#00ccff',    // Germany - Cyan
    FR: '#0099ff',    // France - Blue
    NL: '#0066ff',    // Netherlands - Royal Blue
    GB: '#3399ff',    // UK - Sky Blue
    UA: '#00ffff',    // Ukraine - Aqua
    PL: '#66ccff',    // Poland - Light Blue
    RO: '#3366ff',    // Romania - Medium Blue
    IT: '#00cc99',    // Italy - Teal
    ES: '#00ff99',    // Spain - Mint

    // Americas - Greens and Purples
    US: '#00ff00',    // USA - Green (if attacking)
    BR: '#00cc00',    // Brazil - Dark Green
    MX: '#66ff66',    // Mexico - Light Green
    AR: '#33cc33',    // Argentina - Medium Green
    CO: '#99ff99',    // Colombia - Pale Green
    CA: '#00ff66',    // Canada - Spring Green

    // Africa/Middle East - Purples and Magentas
    NG: '#9900ff',    // Nigeria - Purple
    ZA: '#cc00ff',    // South Africa - Magenta
    EG: '#ff00ff',    // Egypt - Fuchsia
    KE: '#cc66ff',    // Kenya - Lavender
    MA: '#ff66cc',    // Morocco - Pink-Purple
    SA: '#ff0099',    // Saudi Arabia - Hot Pink
    AE: '#ff33cc',    // UAE - Rose
    IL: '#cc00cc',    // Israel - Dark Magenta

    // Oceania
    AU: '#ffff00',    // Australia - Yellow
    NZ: '#ccff00',    // New Zealand - Lime

    // Default for unknown countries
    default: '#ffa500'  // Orange fallback
  };

  /**
   * Get RGBA color array for a country code (used by D3 flat map)
   * @param {string} countryCode - ISO 2-letter country code
   * @returns {Array} Color as [rgba, rgba] for gradient
   */
  window.getCountryColorRgba = function(countryCode) {
    const code = countryCode ? countryCode.toUpperCase() : 'default';
    const hexColor = COUNTRY_COLORS[code] || COUNTRY_COLORS.default;

    // Convert hex to rgba
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    return [`rgba(${r}, ${g}, ${b}, 0.9)`, `rgba(${r}, ${g}, ${b}, 0.7)`];
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
   * Draw the arc animation with traveling segment (like globe view)
   * Draws only the visible segment each frame for precise arrow alignment
   */
  function drawArc(source, target, color) {
    if (!arcsGroup) return;

    // Create curved path using quadratic bezier for high arc trajectory
    const dx = target[0] - source[0];
    const dy = target[1] - source[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate control point for quadratic bezier (creates high arc like globe)
    const midX = (source[0] + target[0]) / 2;
    const midY = (source[1] + target[1]) / 2;

    // Arc height proportional to distance (higher arc for longer distances)
    const arcHeight = Math.min(distance * 0.4, 150);

    // Control point is above the midpoint (negative Y is up in SVG)
    const controlX = midX;
    const controlY = midY - arcHeight;

    // Quadratic bezier path (used as reference for point calculations)
    const fullArcPath = `M${source[0]},${source[1]} Q${controlX},${controlY} ${target[0]},${target[1]}`;

    // Animation timing
    const arcDuration = 2500;  // 2.5 seconds for arc to travel
    const tailLength = 0.35;   // Trail is 35% of path length

    // Create invisible reference path for calculations
    const refPath = arcsGroup.append('path')
      .attr('d', fullArcPath)
      .attr('fill', 'none')
      .attr('stroke', 'none');

    const pathLength = refPath.node().getTotalLength();

    // Create the visible arc segment (will be updated each frame)
    const arc = arcsGroup.append('path')
      .attr('fill', 'none')
      .attr('stroke', color[0])
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.9);

    // Create arrow head (triangle marker) - points in direction of travel
    const arrowSize = 10;
    const arrow = arcsGroup.append('polygon')
      .attr('points', `0,${-arrowSize} ${arrowSize/2},${arrowSize/2} ${-arrowSize/2},${arrowSize/2}`)
      .attr('fill', color[0])
      .attr('opacity', 1);

    // Animation loop
    const startTime = Date.now();

    function animateArc() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / arcDuration, 1);

      if (progress < 1) {
        // Head position (where the arrow is)
        const headPos = progress * pathLength;
        // Tail position (trails behind, clamped to start)
        const tailPos = Math.max(0, headPos - (pathLength * tailLength));

        // Build path string for just the visible segment
        const numPoints = 20;
        const segmentLength = headPos - tailPos;
        let pathD = '';

        for (let i = 0; i <= numPoints; i++) {
          const t = tailPos + (segmentLength * i / numPoints);
          const pt = refPath.node().getPointAtLength(t);
          if (i === 0) {
            pathD = `M${pt.x},${pt.y}`;
          } else {
            pathD += ` L${pt.x},${pt.y}`;
          }
        }

        arc.attr('d', pathD);

        // Position arrow at the head of the arc
        const headPoint = refPath.node().getPointAtLength(headPos);
        const lookAhead = Math.min(headPos + 3, pathLength);
        const nextPoint = refPath.node().getPointAtLength(lookAhead);
        const angle = Math.atan2(nextPoint.y - headPoint.y, nextPoint.x - headPoint.x) * 180 / Math.PI + 90;

        arrow.attr('transform', `translate(${headPoint.x},${headPoint.y}) rotate(${angle})`);

        requestAnimationFrame(animateArc);
      } else {
        // Animation complete - fade out
        arc.transition()
          .duration(400)
          .attr('opacity', 0)
          .remove();

        arrow.transition()
          .duration(400)
          .attr('opacity', 0)
          .remove();

        refPath.remove();

        // Impact effect at destination
        const impact = arcsGroup.append('circle')
          .attr('cx', target[0])
          .attr('cy', target[1])
          .attr('r', 3)
          .attr('fill', color[0])
          .attr('opacity', 0.9);

        impact.transition()
          .duration(300)
          .attr('r', 15)
          .attr('opacity', 0.6)
          .transition()
          .duration(400)
          .attr('r', 25)
          .attr('opacity', 0)
          .remove();
      }
    }

    // Start animation
    requestAnimationFrame(animateArc);
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
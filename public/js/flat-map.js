/**
 * Flat Map Module
 * 2D Mercator projection world map with attack arc visualization
 * Pattern: IIFE exposing window.initFlatMap, window.drawFlatMapArcs
 */

(function() {
  'use strict';

  let canvas = null;
  let ctx = null;
  let mapImage = null;
  let arcs = [];
  const MAX_ARCS = 500;
  const ARC_LIFETIME = 3000;  // 3 seconds

  // Threat-type color mapping (same as arcs.js)
  const THREAT_COLORS = {
    malware: 'rgba(255, 0, 0, 0.8)',
    intrusion: 'rgba(255, 140, 0, 0.8)',
    ddos: 'rgba(138, 43, 226, 0.8)',
    deny: 'rgba(255, 165, 0, 0.8)',
    default: 'rgba(255, 165, 0, 0.8)'
  };

  // OCDE location (Orange County, CA)
  const OCDE_LAT = 33.7490;
  const OCDE_LNG = -117.8705;

  /**
   * Convert latitude/longitude to canvas X/Y coordinates (Mercator projection)
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lng - Longitude (-180 to 180)
   * @returns {Object} {x, y} canvas coordinates
   */
  function latLngToXY(lat, lng) {
    const width = canvas.width;
    const height = canvas.height;

    // Convert longitude to X (simple linear mapping)
    const x = ((lng + 180) / 360) * width;

    // Convert latitude to Y (Mercator projection)
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
    const y = (height / 2) - (width * mercN / (2 * Math.PI));

    return { x, y };
  }

  /**
   * Draw a curved arc between two points
   * @param {Object} start - Start {x, y}
   * @param {Object} end - End {x, y}
   * @param {string} color - Arc color
   * @param {number} progress - Animation progress (0-1)
   */
  function drawArc(start, end, color, progress) {
    if (progress <= 0) return;

    // Calculate control point for curved arc (peak at midpoint)
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Control point offset (perpendicular to line, creates arc height)
    const arcHeight = dist * 0.2;  // 20% of distance
    const controlX = midX - (dy / dist) * arcHeight;
    const controlY = midY + (dx / dist) * arcHeight;

    // Draw partial arc based on progress
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    // Draw arc up to progress point
    const segments = 50;
    for (let i = 1; i <= Math.floor(segments * progress); i++) {
      const t = i / segments;
      // Quadratic Bezier curve formula
      const x = Math.pow(1 - t, 2) * start.x +
                2 * (1 - t) * t * controlX +
                Math.pow(t, 2) * end.x;
      const y = Math.pow(1 - t, 2) * start.y +
                2 * (1 - t) * t * controlY +
                Math.pow(t, 2) * end.y;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw custom blue ocean world map
   */
  function drawCustomMap() {
    // Draw blue ocean background
    ctx.fillStyle = '#0d47a1';  // Deep blue ocean
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add ocean gradient effect
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(25, 118, 210, 0.3)');  // Lighter blue center
    gradient.addColorStop(1, 'rgba(13, 71, 161, 0.5)');    // Darker blue edges
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw continents as dark silhouettes
    drawContinents();

    // Draw country borders
    ctx.strokeStyle = '#00ffff';  // Cyan borders
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    // Draw grid lines for reference
    for (let lng = -180; lng <= 180; lng += 30) {
      const x = ((lng + 180) / 360) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = latToY(lat);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Convert latitude to Y coordinate
   */
  function latToY(lat) {
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
    return (canvas.height / 2) - (canvas.width * mercN / (2 * Math.PI));
  }

  /**
   * Draw detailed continent shapes using world map data
   */
  function drawContinents() {
    // Load world map data if available
    if (!window.worldMapData) {
      console.error('World map data not loaded');
      return;
    }

    const data = window.worldMapData;

    ctx.fillStyle = '#001a33';  // Very dark blue/black for landmasses
    ctx.strokeStyle = '#00ffff';  // Cyan borders
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;

    // Helper function to draw a polygon from coordinates
    function drawPolygon(coords) {
      if (!coords || coords.length === 0) return;

      ctx.beginPath();
      const firstPoint = latLngToXY(coords[0].lat, coords[0].lng);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < coords.length; i++) {
        const point = latLngToXY(coords[i].lat, coords[i].lng);
        ctx.lineTo(point.x, point.y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw all continents and major islands
    drawPolygon(data.northAmerica);
    drawPolygon(data.southAmerica);
    drawPolygon(data.europe);
    drawPolygon(data.africa);
    drawPolygon(data.asia);
    drawPolygon(data.australia);
    drawPolygon(data.greenland);
    drawPolygon(data.japan);
    drawPolygon(data.britain);
    drawPolygon(data.indonesia);
    drawPolygon(data.newZealand);
    drawPolygon(data.madagascar);
    drawPolygon(data.iceland);
    drawPolygon(data.cuba);

    ctx.globalAlpha = 1.0;

    return; // Skip old drawing code

    // North America (polygon shape)
    ctx.beginPath();
    const na = [
      { lng: -168, lat: 71 },   // Alaska top
      { lng: -130, lat: 70 },   // Canada north
      { lng: -95, lat: 72 },    // Hudson Bay north
      { lng: -55, lat: 60 },    // Newfoundland
      { lng: -55, lat: 45 },    // East coast
      { lng: -66, lat: 45 },    // Maine
      { lng: -70, lat: 42 },    // Boston
      { lng: -75, lat: 40 },    // New York
      { lng: -77, lat: 38 },    // DC
      { lng: -81, lat: 30 },    // Florida north
      { lng: -81, lat: 25 },    // Florida south
      { lng: -97, lat: 26 },    // Texas south
      { lng: -97, lat: 30 },    // Texas
      { lng: -110, lat: 32 },   // Arizona
      { lng: -117, lat: 33 },   // California
      { lng: -124, lat: 40 },   // California north
      { lng: -124, lat: 48 },   // Washington
      { lng: -130, lat: 55 },   // Alaska south
      { lng: -165, lat: 60 }    // Alaska west
    ];
    ctx.moveTo(...getXY(na[0]));
    na.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // South America (elongated shape)
    ctx.beginPath();
    const sa = [
      { lng: -81, lat: 10 },    // Colombia/Venezuela
      { lng: -75, lat: 10 },
      { lng: -60, lat: 5 },     // Guyana
      { lng: -50, lat: 0 },     // Brazil north
      { lng: -35, lat: -5 },    // Brazil east
      { lng: -38, lat: -15 },   // Brazil southeast
      { lng: -48, lat: -25 },   // Brazil south
      { lng: -58, lat: -35 },   // Argentina
      { lng: -65, lat: -40 },   // Argentina south
      { lng: -70, lat: -53 },   // Patagonia
      { lng: -72, lat: -45 },   // Chile south
      { lng: -73, lat: -38 },   // Chile central
      { lng: -71, lat: -30 },   // Chile north
      { lng: -70, lat: -20 },   // Peru/Chile
      { lng: -77, lat: -10 },   // Peru
      { lng: -79, lat: 0 },     // Ecuador
      { lng: -81, lat: 5 }      // Colombia
    ];
    ctx.moveTo(...getXY(sa[0]));
    sa.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Europe (irregular shape)
    ctx.beginPath();
    const eu = [
      { lng: -10, lat: 36 },    // Portugal
      { lng: -5, lat: 43 },     // Spain north
      { lng: 0, lat: 42 },      // France south
      { lng: 5, lat: 46 },      // France east
      { lng: 10, lat: 47 },     // Germany south
      { lng: 15, lat: 50 },     // Germany east
      { lng: 20, lat: 54 },     // Poland
      { lng: 30, lat: 60 },     // Finland
      { lng: 40, lat: 68 },     // Russia north
      { lng: 30, lat: 70 },     // Norway north
      { lng: 15, lat: 68 },     // Norway
      { lng: 10, lat: 60 },     // Sweden
      { lng: 5, lat: 58 },      // Denmark
      { lng: 0, lat: 53 },      // UK
      { lng: -5, lat: 50 },     // UK south
      { lng: -10, lat: 53 },    // Ireland
      { lng: -8, lat: 47 },     // France west
      { lng: -10, lat: 43 }     // Spain west
    ];
    ctx.moveTo(...getXY(eu[0]));
    eu.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Africa (characteristic shape)
    ctx.beginPath();
    const af = [
      { lng: -17, lat: 15 },    // West Africa
      { lng: -10, lat: 10 },
      { lng: 0, lat: 5 },
      { lng: 10, lat: 0 },      // Central Africa
      { lng: 15, lat: -5 },
      { lng: 20, lat: -10 },
      { lng: 30, lat: -15 },
      { lng: 35, lat: -20 },    // Southeast
      { lng: 32, lat: -30 },    // South Africa east
      { lng: 25, lat: -34 },    // South Africa south
      { lng: 18, lat: -34 },    // Cape Town
      { lng: 15, lat: -28 },    // Namibia
      { lng: 12, lat: -15 },    // Angola
      { lng: 10, lat: -5 },     // Congo west
      { lng: 8, lat: 4 },       // Nigeria
      { lng: -5, lat: 5 },      // Ivory Coast
      { lng: -15, lat: 12 },    // Senegal
      { lng: -17, lat: 20 },    // Mauritania
      { lng: -10, lat: 30 },    // Morocco
      { lng: 0, lat: 36 },      // Algeria
      { lng: 10, lat: 37 },     // Tunisia
      { lng: 25, lat: 31 },     // Libya
      { lng: 35, lat: 30 },     // Egypt
      { lng: 43, lat: 12 },     // Horn of Africa
      { lng: 51, lat: 12 },     // Somalia
      { lng: 50, lat: 0 },      // Kenya coast
      { lng: 40, lat: -10 },    // Tanzania
      { lng: 35, lat: -10 }
    ];
    ctx.moveTo(...getXY(af[0]));
    af.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Asia (large mass)
    ctx.beginPath();
    const as = [
      { lng: 35, lat: 30 },     // Middle East
      { lng: 45, lat: 35 },     // Iran west
      { lng: 60, lat: 40 },     // Central Asia
      { lng: 75, lat: 45 },     // Kazakhstan
      { lng: 90, lat: 50 },     // Mongolia
      { lng: 120, lat: 53 },    // Siberia
      { lng: 140, lat: 50 },    // Russia far east
      { lng: 145, lat: 45 },    // Japan north
      { lng: 140, lat: 35 },    // Japan
      { lng: 130, lat: 35 },    // Korea
      { lng: 122, lat: 30 },    // China east
      { lng: 120, lat: 23 },    // China south
      { lng: 110, lat: 20 },    // Vietnam
      { lng: 105, lat: 10 },    // Thailand
      { lng: 100, lat: 0 },     // Malaysia
      { lng: 95, lat: 5 },      // Indonesia
      { lng: 90, lat: 10 },     // Bay of Bengal
      { lng: 80, lat: 8 },      // Sri Lanka
      { lng: 75, lat: 15 },     // India south
      { lng: 72, lat: 20 },     // India west
      { lng: 68, lat: 25 },     // Pakistan
      { lng: 60, lat: 25 },     // Iran south
      { lng: 50, lat: 25 },     // Saudi Arabia
      { lng: 43, lat: 30 }      // Middle East west
    ];
    ctx.moveTo(...getXY(as[0]));
    as.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Australia
    ctx.beginPath();
    const au = [
      { lng: 113, lat: -22 },   // West Australia
      { lng: 115, lat: -32 },   // Perth
      { lng: 117, lat: -35 },   // South west
      { lng: 135, lat: -36 },   // South
      { lng: 140, lat: -38 },   // Victoria
      { lng: 148, lat: -38 },   // Tasmania area
      { lng: 153, lat: -28 },   // Brisbane
      { lng: 152, lat: -20 },   // Queensland
      { lng: 145, lat: -15 },   // North Queensland
      { lng: 135, lat: -12 },   // Northern Territory
      { lng: 125, lat: -15 },   // Northwest
      { lng: 115, lat: -20 }    // West
    ];
    ctx.moveTo(...getXY(au[0]));
    au.forEach(point => ctx.lineTo(...getXY(point)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  /**
   * Helper function to convert lat/lng to canvas coordinates
   */
  function getXY(point) {
    const coords = latLngToXY(point.lat, point.lng);
    return [coords.x, coords.y];
  }

  /**
   * Animation loop for flat map
   */
  function animate() {
    if (!canvas || canvas.style.display === 'none') return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw custom blue ocean map
    drawCustomMap();

    // Draw arcs
    const now = Date.now();
    arcs = arcs.filter(arc => {
      const age = now - arc.timestamp;
      if (age > ARC_LIFETIME) return false;

      const progress = Math.min(1, age / ARC_LIFETIME);
      drawArc(arc.start, arc.end, arc.color, progress);
      return true;
    });

    requestAnimationFrame(animate);
  }

  /**
   * Initialize flat map canvas
   */
  window.initFlatMap = function() {
    canvas = document.getElementById('flat-map');
    if (!canvas) {
      console.error('Flat map canvas not found');
      return false;
    }

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx = canvas.getContext('2d');

    // No need to load image - we draw custom blue ocean map
    console.log('Flat map initialized with custom blue ocean rendering');
    return true;
  };

  /**
   * Add attack arc to flat map
   * @param {Object} attackEvent - Attack event with geo data
   */
  window.addFlatMapArc = function(attackEvent) {
    if (!canvas || !ctx) {
      console.warn('Flat map not initialized');
      return;
    }

    // Validate attack event
    if (!attackEvent || !attackEvent.geo) {
      console.warn('Invalid attack event for flat map');
      return;
    }

    // Get source coordinates
    const countryCode = attackEvent.geo.country_code || attackEvent.geo.countryCode;
    if (!countryCode) return;

    const sourceCoords = window.getCountryCoordinates(countryCode);
    if (!sourceCoords) return;

    // Get threat type
    const threatType = (attackEvent.attack && attackEvent.attack.threat_type) ||
                       attackEvent.threatType ||
                       'default';
    const color = THREAT_COLORS[threatType] || THREAT_COLORS.default;

    // Convert lat/lng to canvas coordinates
    const start = latLngToXY(sourceCoords[0], sourceCoords[1]);
    const end = latLngToXY(OCDE_LAT, OCDE_LNG);

    // Add arc
    const arc = {
      start,
      end,
      color,
      timestamp: Date.now()
    };

    if (arcs.length >= MAX_ARCS) {
      arcs.shift();
    }
    arcs.push(arc);

    console.log('[Flat Map Arc] Added from', countryCode, '- Color:', color);
  };

  /**
   * Start flat map rendering
   */
  window.startFlatMap = function() {
    if (!canvas) {
      console.error('Cannot start flat map - not initialized');
      return;
    }
    canvas.style.display = 'block';
    animate();
    console.log('Flat map started');
  };

  /**
   * Stop flat map rendering
   */
  window.stopFlatMap = function() {
    if (!canvas) return;
    canvas.style.display = 'none';
    console.log('Flat map stopped');
  };

  /**
   * Handle window resize
   */
  window.addEventListener('resize', function() {
    if (canvas && canvas.style.display !== 'none') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });

  console.log('Flat map module loaded');

})();

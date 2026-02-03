/**
 * Custom Three.js Arc Animation Module
 * Provides independent arc animations bypassing Globe.GL's arc system
 * Pattern: IIFE exposing window.addCustomArc and window.clearCustomArcs
 */

(function() {
  'use strict';

  // Animation state
  let animatingArcs = [];
  let animationFrameId = null;
  let globeInstance = null;
  let coordinateCache = new Map();  // Cache for coordinate conversions

  // Arc configuration
  const GLOBE_RADIUS = 100;  // Globe.GL default radius
  const ARC_ALTITUDE_FACTOR = 0.8;  // Height of arc trajectory - ballistic missile style (increased for high arc)
  const ARC_SEGMENTS = 128;  // Smoothness of arc curve (increased from 64 for smoother arcs)
  const ARC_ANIMATION_DURATION = 3000;  // 3 seconds in milliseconds (increased from 1500ms)
  const VISIBLE_SEGMENT_RATIO = 0.5;  // 50% of arc visible at once (increased from 0.4)
  const COUNTRY_FLASH_DURATION = 500;  // Duration of country flash animation in ms
  const COUNTRY_FLASH_DELAY = 300;  // Delay before arc starts after flash begins

  // Threat-type color mapping (matching arcs.js)
  const THREAT_COLORS = {
    malware: 0xff0000,        // Red
    intrusion: 0xff8c00,      // Dark orange
    ddos: 0x8a2be2,           // Purple
    deny: 0xffa500,           // Orange
    default: 0xffa500         // Orange fallback
  };

  /**
   * Convert lat/lng coordinates to 3D Cartesian coordinates
   * Using Globe.GL's internal coordinate system by accessing the globe object
   * @param {number} lat - Latitude in degrees (-90 to 90)
   * @param {number} lng - Longitude in degrees (-180 to 180)
   * @param {number} altitude - Altitude above globe surface (0-1 range)
   * @returns {THREE.Vector3} 3D position vector
   */
  function latLngToCartesian(lat, lng, altitude = 0) {
    // Using three-globe's exact polar2Cartesian formula
    // Source: https://github.com/vasturiano/three-globe/blob/master/src/utils/coordTranslate.js
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (90 - lng) * Math.PI / 180;  // KEY: theta uses (90 - lng), not (lng + 180)
    const radius = GLOBE_RADIUS * (1 + altitude);

    const phiSin = Math.sin(phi);
    const x = radius * phiSin * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * phiSin * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Create ballistic arc curve (like a missile trajectory)
   * High parabolic arc that peaks significantly above the globe
   * @param {number} startLat - Starting latitude
   * @param {number} startLng - Starting longitude
   * @param {number} endLat - Ending latitude
   * @param {number} endLng - Ending longitude
   * @returns {THREE.QuadraticBezierCurve3} Arc curve path
   */
  function createArcCurve(startLat, startLng, endLat, endLng) {
    // Start and end points on globe surface
    const startPoint = latLngToCartesian(startLat, startLng, 0);
    const endPoint = latLngToCartesian(endLat, endLng, 0);

    // Calculate the straight-line 3D midpoint (Euclidean space, not spherical)
    const midPoint3D = new THREE.Vector3()
      .addVectors(startPoint, endPoint)
      .multiplyScalar(0.5);

    // Calculate distance for altitude scaling
    const distance = startPoint.distanceTo(endPoint);
    const altitudeScale = Math.min(distance / (GLOBE_RADIUS * 2), 1);

    // Ballistic trajectory - much higher peak
    const altitude = ARC_ALTITUDE_FACTOR * altitudeScale;

    // For ballistic arc, push the midpoint radially outward from Earth's center
    // This creates a high parabolic trajectory like a missile
    const direction = midPoint3D.clone().normalize();
    const controlPoint = direction.multiplyScalar(GLOBE_RADIUS * (1 + altitude));

    // Create quadratic bezier curve for ballistic trajectory
    return new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
  }

  /**
   * Create arc geometry from curve (using TubeGeometry for thicker lines)
   * @param {THREE.QuadraticBezierCurve3} curve - Arc curve path
   * @returns {THREE.BufferGeometry} Arc geometry
   */
  function createArcGeometry(curve) {
    // Use TubeGeometry to create thicker arcs
    const geometry = new THREE.TubeGeometry(curve, ARC_SEGMENTS, 0.3, 8, false);  // Radius 0.3 for visible thickness
    return geometry;
  }

  /**
   * Create arrow head geometry
   * @param {THREE.Vector3} position - Position for arrow head
   * @param {THREE.Vector3} direction - Direction arrow should point
   * @param {number} color - Color as hex value
   * @returns {THREE.Mesh} Arrow head mesh
   */
  function createArrowHead(position, direction, color) {
    // Larger, more visible arrow head
    const arrowGeometry = new THREE.ConeGeometry(1.5, 4.5, 8);  // Increased from (1.0, 3.0) for better visibility
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0  // Fully opaque
    });
    const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);

    // Position arrow head
    arrowMesh.position.copy(position);

    // Orient arrow to point in direction of travel
    arrowMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return arrowMesh;
  }

  /**
   * Create country flash pulse at source location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} color - Color as hex value
   * @returns {THREE.Mesh} Flash sphere mesh
   */
  function createCountryFlash(lat, lng, color) {
    // Create sphere at source location (slightly above globe surface)
    const position = latLngToCartesian(lat, lng, 0.02);  // Small altitude offset

    const flashGeometry = new THREE.SphereGeometry(3, 16, 16);  // Visible size
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(position);

    return flashMesh;
  }

  /**
   * Add custom animated arc to globe
   * @param {Object} arcData - Arc data object
   * @param {number} arcData.startLat - Starting latitude
   * @param {number} arcData.startLng - Starting longitude
   * @param {number} arcData.endLat - Ending latitude
   * @param {number} arcData.endLng - Ending longitude
   * @param {string} arcData.threatType - Threat type for coloring
   */
  window.addCustomArc = function(arcData) {
    // Get globe instance
    if (!globeInstance) {
      globeInstance = window.getGlobe();
      if (!globeInstance) {
        console.warn('Globe not initialized - cannot add custom arc');
        return;
      }
    }

    // Debug: Log all arc coordinates
    console.log('[Custom Arc] Creating arc:');
    console.log('  Start:', arcData.startLat.toFixed(4), arcData.startLng.toFixed(4), '(' + (arcData.countryCode || 'Unknown') + ')');
    console.log('  End:', arcData.endLat.toFixed(4), arcData.endLng.toFixed(4), '(OCDE)');

    // Create arc curve
    const curve = createArcCurve(
      arcData.startLat,
      arcData.startLng,
      arcData.endLat,
      arcData.endLng
    );

    // Create arc geometry
    const geometry = createArcGeometry(curve);

    // Determine color based on threat type
    const threatType = arcData.threatType || 'default';
    const color = THREAT_COLORS[threatType] || THREAT_COLORS.default;

    // Create arc material with high visibility (MeshBasicMaterial for TubeGeometry)
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0  // Fully opaque for better visibility
    });

    // Create mesh (TubeGeometry creates a mesh, not a line)
    const arcLine = new THREE.Mesh(geometry, material);

    // Create country flash/pulse at source location
    const countryFlash = createCountryFlash(arcData.startLat, arcData.startLng, color);

    // Add arc to scene (initially hidden)
    const scene = globeInstance.scene();
    arcLine.visible = false;  // Hide until flash completes
    scene.add(arcLine);

    // Add country flash to scene
    scene.add(countryFlash);

    // Create arrow head at starting position (initially hidden)
    const startPoint = curve.getPoint(0);
    const initialDirection = curve.getTangent(0);
    const arrowHead = createArrowHead(startPoint, initialDirection, color);
    arrowHead.visible = false;  // Hide until flash completes
    scene.add(arrowHead);

    // Create animation state object
    const arcAnimation = {
      id: `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      curve: curve,
      geometry: geometry,
      line: arcLine,
      arrowHead: arrowHead,
      countryFlash: countryFlash,
      material: material,
      arrowMaterial: arrowHead.material,
      flashMaterial: countryFlash.material,
      startTime: Date.now(),
      flashDuration: COUNTRY_FLASH_DURATION,
      arcDelay: COUNTRY_FLASH_DELAY,
      duration: ARC_ANIMATION_DURATION,
      color: color,
      metadata: {
        threatType: threatType,
        sourceIP: arcData.sourceIP,
        countryCode: arcData.countryCode
      }
    };

    // Add to animating arcs array
    animatingArcs.push(arcAnimation);

    // Start animation loop if not already running
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animateArcs);
    }

    console.log('[Custom Arc Added]', arcData.countryCode || 'Unknown', '->', 'OCDE',
                `[${threatType}]`, `Start: (${arcData.startLat.toFixed(2)}, ${arcData.startLng.toFixed(2)})`,
                `End: (${arcData.endLat.toFixed(2)}, ${arcData.endLng.toFixed(2)})`,
                `(${animatingArcs.length} active)`);
  };

  /**
   * Animation loop for all active arcs
   */
  function animateArcs() {
    const now = Date.now();
    const scene = globeInstance ? globeInstance.scene() : null;

    if (!scene) {
      animationFrameId = null;
      return;
    }

    // Track arcs to remove (completed animations)
    const arcsToRemove = [];

    // Update each arc
    animatingArcs.forEach((arcAnim, index) => {
      const elapsed = now - arcAnim.startTime;

      // Phase 1: Country Flash (0ms - flashDuration)
      if (elapsed < arcAnim.flashDuration) {
        // Pulsing animation for country flash
        const flashProgress = elapsed / arcAnim.flashDuration;
        // Create pulsing effect with sine wave
        const pulse = Math.sin(flashProgress * Math.PI * 4); // 4 pulses during flash
        const scale = 1 + pulse * 0.5;  // Scale between 0.5x and 1.5x
        const opacity = 0.9 - (flashProgress * 0.3);  // Fade from 0.9 to 0.6

        arcAnim.countryFlash.scale.set(scale, scale, scale);
        arcAnim.flashMaterial.opacity = opacity;
        return;  // Skip arc animation during flash phase
      }

      // Phase 2: Show arc after delay (flashDuration + arcDelay)
      if (elapsed >= arcAnim.flashDuration && elapsed < arcAnim.flashDuration + arcAnim.arcDelay) {
        // Fade out the flash during the delay
        const fadeProgress = (elapsed - arcAnim.flashDuration) / arcAnim.arcDelay;
        arcAnim.flashMaterial.opacity = 0.6 * (1 - fadeProgress);

        // Make arc visible when delay starts
        if (!arcAnim.line.visible) {
          arcAnim.line.visible = true;
          arcAnim.arrowHead.visible = true;
        }
        return;  // Wait for arc to start
      }

      // Remove flash after delay completes
      if (arcAnim.countryFlash.visible && elapsed >= arcAnim.flashDuration + arcAnim.arcDelay) {
        scene.remove(arcAnim.countryFlash);
        arcAnim.countryFlash.visible = false;
      }

      // Phase 3: Arc Animation
      const arcElapsed = elapsed - (arcAnim.flashDuration + arcAnim.arcDelay);
      const progress = Math.min(arcElapsed / arcAnim.duration, 1);

      if (progress >= 1) {
        // Animation complete - fade out
        const fadeProgress = Math.min((arcElapsed - arcAnim.duration) / 500, 1);
        const opacity = 1 - fadeProgress;

        arcAnim.material.opacity = opacity * 0.9;
        arcAnim.arrowMaterial.opacity = opacity * 0.9;

        // Remove after fade completes
        if (fadeProgress >= 1) {
          arcsToRemove.push(index);
        }
      } else {
        // Calculate visible segment of arc
        const segmentStart = Math.max(0, progress - VISIBLE_SEGMENT_RATIO);
        const segmentEnd = progress;

        // Update draw range to show traveling segment
        // TubeGeometry uses indexed rendering, so we need to work with triangle indices
        // Each segment has radialSegments*2 triangles, each triangle has 3 indices
        const radialSegments = 8;  // Must match the 4th parameter in TubeGeometry (line 97)
        const trianglesPerSegment = radialSegments * 2;
        const indicesPerSegment = trianglesPerSegment * 3;

        const drawStart = Math.floor(segmentStart * ARC_SEGMENTS * indicesPerSegment);
        const drawCount = Math.ceil((segmentEnd - segmentStart) * ARC_SEGMENTS * indicesPerSegment);

        arcAnim.geometry.setDrawRange(drawStart, drawCount);

        // Update arrow head position and direction
        const arrowPosition = arcAnim.curve.getPoint(progress);
        const arrowDirection = arcAnim.curve.getTangent(progress);

        arcAnim.arrowHead.position.copy(arrowPosition);
        arcAnim.arrowHead.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          arrowDirection.normalize()
        );
      }
    });

    // Remove completed arcs (iterate backwards to avoid index issues)
    for (let i = arcsToRemove.length - 1; i >= 0; i--) {
      const index = arcsToRemove[i];
      const arcAnim = animatingArcs[index];

      // Remove from scene
      scene.remove(arcAnim.line);
      scene.remove(arcAnim.arrowHead);
      if (arcAnim.countryFlash.visible) {
        scene.remove(arcAnim.countryFlash);
      }

      // Dispose geometries and materials
      arcAnim.geometry.dispose();
      arcAnim.material.dispose();
      arcAnim.arrowMaterial.dispose();
      arcAnim.countryFlash.geometry.dispose();
      arcAnim.flashMaterial.dispose();

      // Remove from array
      animatingArcs.splice(index, 1);

      console.debug('[Custom Arc Removed]',
                    arcAnim.metadata.countryCode || 'Unknown',
                    `(${animatingArcs.length} active)`);
    }

    // Continue animation loop if there are still active arcs
    if (animatingArcs.length > 0) {
      animationFrameId = requestAnimationFrame(animateArcs);
    } else {
      animationFrameId = null;
    }
  }

  /**
   * Clear all custom arcs from globe
   */
  window.clearCustomArcs = function() {
    if (!globeInstance) return;

    const scene = globeInstance.scene();

    // Remove all arcs from scene
    animatingArcs.forEach(arcAnim => {
      scene.remove(arcAnim.line);
      scene.remove(arcAnim.arrowHead);
      arcAnim.geometry.dispose();
      arcAnim.material.dispose();
      arcAnim.arrowMaterial.dispose();
    });

    // Clear array
    animatingArcs = [];

    // Cancel animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    console.log('All custom arcs cleared');
  };

  /**
   * Get current custom arc count
   * @returns {number} Number of active custom arcs
   */
  window.getCustomArcCount = function() {
    return animatingArcs.length;
  };

  console.log('Custom arc animation module loaded');

})();

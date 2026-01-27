/**
 * Browser-side performance monitoring module
 *
 * Monitors FPS using stats.js and implements progressive quality degradation
 * to maintain 30+ FPS target under heavy animation load.
 *
 * Progressive degradation levels:
 * - Level 0: Full quality (2.0 pixel ratio, atmosphere, 500 arcs)
 * - Level 1: Slight reduction (1.5 pixel ratio, atmosphere, 500 arcs)
 * - Level 2: Medium reduction (1.0 pixel ratio, atmosphere, 400 arcs)
 * - Level 3: Heavy reduction (1.0 pixel ratio, no atmosphere, 300 arcs)
 * - Level 4: Maximum reduction (1.0 pixel ratio, no atmosphere, 200 arcs)
 *
 * Uses IIFE pattern to expose functions to window scope for browser use.
 */
(function() {
  'use strict';

  let degradationLevel = 0;
  let fpsSamples = [];
  const TARGET_FPS = 55.5;
  const MIN_FPS = 30.0;  // Minimum acceptable FPS
  const RECOVERY_FPS = 58.0;  // FPS needed to recover quality level
  let statsPanel = null;

  /**
   * Start FPS monitoring and progressive degradation
   * Requires Stats.js to be loaded globally (from CDN or package)
   */
  window.startMonitoring = function() {
    // Check if Stats.js is available
    if (typeof Stats === 'undefined') {
      console.error('Stats.js not loaded - FPS monitoring disabled');
      console.error('Load Stats.js from: <script src="https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/Stats.min.js"></script>');
      return;
    }

    // Create stats panel for FPS display
    statsPanel = new Stats();
    statsPanel.showPanel(0); // 0: fps, 1: ms, 2: mb
    statsPanel.dom.style.position = 'absolute';
    statsPanel.dom.style.left = '20px';
    statsPanel.dom.style.top = '20px';
    statsPanel.dom.style.zIndex = '100';
    document.body.appendChild(statsPanel.dom);

    console.log('Performance monitoring started - Target FPS:', TARGET_FPS);

    // Monitor FPS and apply degradation
    let frameCount = 0;
    let lastTime = performance.now();

    function monitorFrame() {
      statsPanel.begin();

      // Calculate FPS from frame time
      const now = performance.now();
      const deltaTime = now - lastTime;
      lastTime = now;
      const currentFPS = deltaTime > 0 ? 1000 / deltaTime : 60;
      fpsSamples.push(currentFPS);

      // Keep only last 60 samples (1 second at 60 FPS)
      if (fpsSamples.length > 60) {
        fpsSamples.shift();
      }

      // Every 60 frames (~1 second), check average and adjust
      frameCount++;
      if (frameCount >= 60) {
        frameCount = 0;
        const avgFPS = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

        // Degrade if below target
        if (avgFPS < TARGET_FPS && degradationLevel < 4) {
          degradationLevel++;
          console.log(`[Performance] Degrading to level ${degradationLevel} (avg FPS: ${avgFPS.toFixed(1)})`);
          applyDegradation(degradationLevel);
        }
        // Recover if performing well
        else if (avgFPS > RECOVERY_FPS && degradationLevel > 0) {
          degradationLevel--;
          console.log(`[Performance] Recovering to level ${degradationLevel} (avg FPS: ${avgFPS.toFixed(1)})`);
          applyDegradation(degradationLevel);
        }
        // Warn if critically low
        else if (avgFPS < MIN_FPS) {
          console.warn(`[Performance] FPS critically low: ${avgFPS.toFixed(1)} (min: ${MIN_FPS})`);
        }
      }

      statsPanel.end();
      requestAnimationFrame(monitorFrame);
    }

    requestAnimationFrame(monitorFrame);
  };

  /**
   * Get current degradation level (0-4)
   * @returns {number} Current degradation level
   */
  window.getDegradationLevel = function() {
    return degradationLevel;
  };

  /**
   * Get current FPS average from samples
   * @returns {number} Average FPS or 0 if no samples
   */
  window.getCurrentFPS = function() {
    if (fpsSamples.length === 0) return 0;
    return fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
  };

  /**
   * Apply degradation level to globe rendering
   * @param {number} level - Degradation level (0-4)
   */
  function applyDegradation(level) {
    // Get globe instance from window (set by globe module)
    const globe = window.getGlobe ? window.getGlobe() : null;
    if (!globe) {
      console.warn('Globe instance not available for degradation');
      return;
    }

    const renderer = globe.renderer();

    switch(level) {
      case 0: // Full quality
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
        globe.showAtmosphere(true);
        window.MAX_ARCS = 500;
        console.log('[Performance] Level 0: Full quality (pixelRatio: 2.0, atmosphere: on, maxArcs: 500)');
        break;

      case 1: // Slight reduction
        renderer.setPixelRatio(1.5);
        globe.showAtmosphere(true);
        window.MAX_ARCS = 500;
        console.log('[Performance] Level 1: Slight reduction (pixelRatio: 1.5, atmosphere: on, maxArcs: 500)');
        break;

      case 2: // Medium reduction
        renderer.setPixelRatio(1.0);
        globe.showAtmosphere(true);
        window.MAX_ARCS = 400;
        console.log('[Performance] Level 2: Medium reduction (pixelRatio: 1.0, atmosphere: on, maxArcs: 400)');
        break;

      case 3: // Heavy reduction
        renderer.setPixelRatio(1.0);
        globe.showAtmosphere(false);
        window.MAX_ARCS = 300;
        console.log('[Performance] Level 3: Heavy reduction (pixelRatio: 1.0, atmosphere: off, maxArcs: 300)');
        break;

      case 4: // Maximum reduction
        renderer.setPixelRatio(1.0);
        globe.showAtmosphere(false);
        window.MAX_ARCS = 200;
        console.log('[Performance] Level 4: Maximum reduction (pixelRatio: 1.0, atmosphere: off, maxArcs: 200)');
        break;

      default:
        console.warn('Invalid degradation level:', level);
    }
  }

  /**
   * Manually set degradation level (for testing)
   * @param {number} level - Degradation level (0-4)
   */
  window.setDegradationLevel = function(level) {
    if (level < 0 || level > 4) {
      console.error('Invalid degradation level, must be 0-4');
      return;
    }
    degradationLevel = level;
    applyDegradation(level);
  };

  /**
   * Stop monitoring and remove stats panel
   */
  window.stopMonitoring = function() {
    if (statsPanel && statsPanel.dom && statsPanel.dom.parentNode) {
      statsPanel.dom.parentNode.removeChild(statsPanel.dom);
      statsPanel = null;
      console.log('Performance monitoring stopped');
    }
  };

  console.log('Performance monitor module initialized');
})();

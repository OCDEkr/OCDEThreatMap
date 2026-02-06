# Globe.GL Workflows Reference

## Contents
- Full Globe Initialization
- Arc Lifecycle Management
- View Switching (Globe/Flat Map)
- Continuous Rotation
- Full Cleanup and Disposal
- Adding a New Visualization Layer

---

## Full Globe Initialization

Copy this checklist and track progress:
- [ ] Step 1: Verify Globe.GL and Three.js loaded from CDN
- [ ] Step 2: Create globe instance on DOM container
- [ ] Step 3: Configure material, atmosphere, and POV
- [ ] Step 4: Load GeoJSON country borders asynchronously
- [ ] Step 5: Load US state borders after countries
- [ ] Step 6: Configure renderer (pixelRatio, shadows, clearColor)
- [ ] Step 7: Set initial empty arc data
- [ ] Step 8: Force scene background to black

### Complete Initialization (from public/js/globe.js)

```javascript
window.initGlobe = function(containerId) {
  const container = document.getElementById(containerId);
  if (!container) { console.error('Container not found:', containerId); return null; }
  if (typeof Globe === 'undefined') { console.error('Globe.GL not loaded'); return null; }

  // Create and configure
  globeInstance = Globe()(container)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .globeMaterial(new THREE.MeshPhongMaterial({
      color: 0x0d47a1, emissive: 0x1976d2, emissiveIntensity: 0.2,
      shininess: 0, specular: 0x000000
    }))
    .showAtmosphere(true)
    .atmosphereColor('#00ffff')
    .pointOfView({ lat: 33.7490, lng: -117.8705, altitude: 2.5 })
    .pointsMerge(true)
    .arcsTransitionDuration(0);

  // Async: Load country borders, then US state borders
  fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
    .then(res => res.json())
    .then(countries => {
      globeInstance.polygonsData(countries.features.map(f => ({ ...f, isCountry: true })))
        .polygonAltitude(0.01)
        .polygonStrokeColor(() => '#ffffff');
      loadUSStateBorders();  // Chain US states after countries
    })
    .catch(err => console.warn('Borders failed:', err));

  // Renderer optimization
  const renderer = globeInstance.renderer();
  renderer.setPixelRatio(1.5);
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 1);
  globeInstance.scene().background = new THREE.Color(0x000000);

  globeInstance.arcsData([]);
  return globeInstance;
};
```

### Script Load Order (from dashboard.html)

Order matters. Three.js must load before Globe.GL, and Globe.GL before custom modules.

```html
<script src="//unpkg.com/three@0.160.0/build/three.min.js"></script>
<script src="//unpkg.com/globe.gl@2.27.0/dist/globe.gl.min.js"></script>
<script src="//unpkg.com/d3@7.8.5/dist/d3.min.js"></script>
<script src="//unpkg.com/topojson@3.0.2/dist/topojson.min.js"></script>

<script src="/js/globe.js"></script>
<script src="/js/coordinates.js"></script>
<script src="/js/custom-arcs.js"></script>
<script src="/js/arcs.js"></script>
```

**Initialization call** in dashboard.html `DOMContentLoaded`:
```javascript
window.initGlobe('globe');
```

---

## Arc Lifecycle Management

### Three-Phase Arc Animation (custom-arcs.js)

Each arc goes through: **Flash** (origin pulse) -> **Travel** (visible segment moves) -> **Fade** (opacity to 0).

```javascript
// Phase 1: Country flash pulse (0ms - 400ms)
if (elapsed < flashDuration) {
  const pulse = Math.sin(flashProgress * Math.PI * 4);
  arcAnim.countryFlash.scale.set(1 + pulse * 0.5, ...);
  arcAnim.flashMaterial.opacity = 0.9 - (flashProgress * 0.3);
  return;
}

// Phase 2: Delay + arc reveal (400ms - 600ms)
if (elapsed < flashDuration + arcDelay) {
  arcAnim.line.visible = true;
  arcAnim.arrowHead.visible = true;
  return;
}

// Phase 3: Arc travel animation (600ms - 2600ms)
const progress = arcElapsed / duration;
geometry.setDrawRange(drawStart, drawCount);
arrowHead.position.copy(curve.getPoint(progress));
arrowHead.quaternion.setFromUnitVectors(UP, curve.getTangent(progress).normalize());
```

### Create -> Animate -> Cleanup Flow

```javascript
window.addCustomArc = function(arcData) {
  if (shouldSkipArc()) return;        // Adaptive sampling at high volume
  if (animatingArcs.length >= 150) {  // Evict oldest arc
    const oldest = animatingArcs.shift();
    disposeArc(oldest);               // scene.remove + dispose geometry/material
  }

  const curve = createArcCurve(...);
  const geometry = new THREE.TubeGeometry(curve, 64, 0.3, 6, false);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);

  scene.add(mesh);
  animatingArcs.push({ mesh, geometry, material, curve, startTime: Date.now() });

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(animateArcs);
  }
};
```

### Animation Loop Cleanup Pattern

```javascript
function animateArcs() {
  const arcsToRemove = [];

  animatingArcs.forEach((arc, index) => {
    if (isComplete(arc)) {
      arcsToRemove.push(index);
    } else {
      updateArc(arc);
    }
  });

  // CRITICAL: Remove backwards to avoid index shift bugs
  for (let i = arcsToRemove.length - 1; i >= 0; i--) {
    const arc = animatingArcs[arcsToRemove[i]];
    scene.remove(arc.line);
    scene.remove(arc.arrowHead);
    if (arc.countryFlash.visible) scene.remove(arc.countryFlash);
    arc.geometry.dispose();
    arc.material.dispose();
    arc.arrowMaterial.dispose();
    arc.countryFlash.geometry.dispose();
    arc.flashMaterial.dispose();
    animatingArcs.splice(arcsToRemove[i], 1);
  }

  // Self-terminating: stop loop when no arcs remain
  if (animatingArcs.length > 0) {
    animationFrameId = requestAnimationFrame(animateArcs);
  } else {
    animationFrameId = null;
  }
}
```

---

## View Switching (Globe/Flat Map)

The dashboard supports toggling between 3D Globe.GL and 2D D3.js views. Both views receive the same WebSocket events. See the **d3** skill for flat map details.

```javascript
if (currentView === 'globe') {
  document.getElementById('globe').style.display = 'none';
  window.startD3FlatMap();
  currentView = 'flat';
} else {
  window.stopD3FlatMap();
  document.getElementById('globe').style.display = 'block';
  currentView = 'globe';
}
```

**Note:** `dashboard-client.js:69-95` sends events to both `addAttackArc()` (globe) and `addD3Arc()` (flat map). Only the visible view renders. See the **websocket** skill for event flow.

---

## Continuous Rotation

```javascript
let isRotating = false;
let rotationAnimationId = null;

window.startGlobeRotation = function() {
  if (isRotating) return;

  // Center on US first, then start rotating
  globeInstance.pointOfView({ lat: 39.8283, lng: -98.5795, altitude: 2.5 }, 1000);

  setTimeout(() => {
    isRotating = true;
    function animate() {
      if (!isRotating) return;
      const current = globeInstance.pointOfView();
      let newLng = current.lng - 0.2;  // Counter-clockwise, ~30s per revolution
      if (newLng < -180) newLng += 360;
      globeInstance.pointOfView({
        lat: current.lat, lng: newLng, altitude: current.altitude
      }, 0);  // Duration MUST be 0
      rotationAnimationId = requestAnimationFrame(animate);
    }
    animate();
  }, 1000);
};

window.stopGlobeRotation = function() {
  isRotating = false;
  if (rotationAnimationId) {
    cancelAnimationFrame(rotationAnimationId);
    rotationAnimationId = null;
  }
};
```

**Important:** Duration must be `0` for smooth continuous rotation. Any non-zero value creates jerky movement due to Globe.GL's internal camera tween competing with the animation frame loop.

---

## Full Cleanup and Disposal

Copy this checklist for cleanup:
- [ ] Cancel all animation frames (`cancelAnimationFrame`)
- [ ] Remove all custom meshes from scene (`scene.remove`)
- [ ] Dispose ALL geometries (arc tube, arrow cone, flash sphere)
- [ ] Dispose ALL materials (arc, arrow, flash)
- [ ] Clear tracking arrays

```javascript
window.clearCustomArcs = function() {
  const scene = globeInstance.scene();

  animatingArcs.forEach(arc => {
    scene.remove(arc.line);
    scene.remove(arc.arrowHead);
    if (arc.countryFlash.visible) scene.remove(arc.countryFlash);
    arc.geometry.dispose();
    arc.material.dispose();
    arc.arrowMaterial.dispose();
    arc.countryFlash.geometry.dispose();
    arc.flashMaterial.dispose();
  });

  animatingArcs = [];

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};
```

---

## Adding a New Visualization Layer

1. Create geometry/material for the new element
2. Add to `globeInstance.scene()` directly
3. Track in a module-scoped array for animation
4. Hook into the existing `requestAnimationFrame` loop or start a new one
5. Implement disposal in a cleanup function

Validate:
1. Open dashboard at `http://localhost:3000/dashboard`
2. Run `node test/send-random-attacks.js` to generate test traffic
3. Verify new layer renders correctly alongside existing arcs
4. Check `window.getArcPerformanceStats()` in browser console for FPS impact
5. If FPS drops below 30, reduce geometry complexity and repeat step 3

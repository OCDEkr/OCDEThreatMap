# Three.js Workflows Reference

## Contents
- Adding Custom 3D Objects to Globe.GL
- Performance Optimization Workflow
- Coordinate System Integration
- Animation Lifecycle Management
- Debugging 3D Issues

---

## Adding Custom 3D Objects to Globe.GL

Globe.GL wraps Three.js but exposes the scene for custom additions.

### Workflow Checklist

Copy this checklist and track progress:
- [ ] Step 1: Get globe instance via `window.getGlobe()`
- [ ] Step 2: Access scene via `globe.scene()`
- [ ] Step 3: Create geometry and material
- [ ] Step 4: Create mesh and add to scene
- [ ] Step 5: Implement update/animation loop
- [ ] Step 6: Implement cleanup with dispose calls

### Example: Adding a Custom Arc

```javascript
window.addCustomArc = function(arcData) {
  // Step 1-2: Get scene
  const globe = window.getGlobe();
  if (!globe) return;
  const scene = globe.scene();
  
  // Step 3: Create geometry and material
  const curve = createArcCurve(arcData.startLat, arcData.startLng, 
                               arcData.endLat, arcData.endLng);
  const geometry = new THREE.TubeGeometry(curve, 128, 0.3, 8, false);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  
  // Step 4: Create mesh and add
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  // Step 5-6: Track for animation and cleanup
  animatingArcs.push({ mesh, geometry, material, curve, startTime: Date.now() });
  startAnimationLoop();
};
```

---

## Performance Optimization Workflow

### Progressive Quality Degradation

This codebase implements automatic quality reduction when FPS drops below target.

```javascript
// Degradation levels and thresholds
const TARGET_FPS = 55.5;
const RECOVERY_FPS = 58.0;
const MIN_FPS = 30.0;

function applyDegradation(level) {
  const globe = window.getGlobe();
  const renderer = globe.renderer();
  
  switch(level) {
    case 0:  // Full quality
      renderer.setPixelRatio(2.0);
      globe.showAtmosphere(true);
      break;
    case 2:  // Medium reduction
      renderer.setPixelRatio(1.0);
      globe.showAtmosphere(true);
      break;
    case 4:  // Maximum reduction
      renderer.setPixelRatio(1.0);
      globe.showAtmosphere(false);
      break;
  }
}
```

### Renderer Optimization Settings

```javascript
const renderer = globe.renderer();

// Balance quality vs performance
renderer.setPixelRatio(1.5);  // Not full devicePixelRatio

// Disable expensive features
renderer.shadowMap.enabled = false;

// Set clear color for pure black background
renderer.setClearColor(0x000000, 1);
```

### Arc Count Limiting

```javascript
const MAX_ARCS = 500;

window.addAttackArc = function(attackEvent) {
  if (arcs.length >= MAX_ARCS) {
    arcs.shift();  // Remove oldest arc
  }
  // ... add new arc
};
```

### Feedback Loop: FPS Monitoring

1. Collect FPS samples over 60 frames
2. Check average against thresholds
3. If below TARGET_FPS, increase degradation level
4. If above RECOVERY_FPS, decrease degradation level
5. Repeat monitoring

```javascript
if (avgFPS < TARGET_FPS && degradationLevel < 4) {
  degradationLevel++;
  applyDegradation(degradationLevel);
} else if (avgFPS > RECOVERY_FPS && degradationLevel > 0) {
  degradationLevel--;
  applyDegradation(degradationLevel);
}
```

---

## Coordinate System Integration

### Globe.GL Coordinate Formula

Globe.GL uses three-globe's `polar2Cartesian` formula. **Critical:** The theta calculation uses `(90 - lng)`, not `(lng + 180)`.

```javascript
function latLngToCartesian(lat, lng, altitude = 0) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;  // NOT (lng + 180)
  const radius = GLOBE_RADIUS * (1 + altitude);
  
  const phiSin = Math.sin(phi);
  return new THREE.Vector3(
    radius * phiSin * Math.cos(theta),
    radius * Math.cos(phi),
    radius * phiSin * Math.sin(theta)
  );
}
```

### WARNING: Incorrect Longitude Formula

**The Problem:**

```javascript
// BAD - Common formula from other globe libraries
const theta = (lng + 180) * Math.PI / 180;
```

**Why This Breaks:** Arcs appear rotated 90 degrees from correct position. Source countries render in wrong locations.

**The Fix:**

```javascript
// GOOD - Match Globe.GL's internal formula
const theta = (90 - lng) * Math.PI / 180;
```

### Validating Coordinate Alignment

```javascript
// Test with known coordinates
const ocdePosition = latLngToCartesian(33.7490, -117.8705, 0);
console.log('OCDE position:', ocdePosition);
// Should align with globe's California location
```

---

## Animation Lifecycle Management

### Full Arc Lifecycle

```javascript
const arcAnimation = {
  id: `arc_${Date.now()}`,
  
  // Three.js objects
  curve: curve,
  geometry: geometry,
  line: arcMesh,
  arrowHead: arrowMesh,
  countryFlash: flashMesh,
  
  // Materials (for opacity animation and disposal)
  material: lineMaterial,
  arrowMaterial: arrowMaterial,
  flashMaterial: flashMaterial,
  
  // Timing
  startTime: Date.now(),
  flashDuration: 500,
  arcDelay: 300,
  duration: 3000,
  
  // Metadata (for logging)
  metadata: { threatType, sourceIP, countryCode }
};
```

### Cleanup on Completion

```javascript
function cleanupArc(arcAnim, scene) {
  // Remove from scene
  scene.remove(arcAnim.line);
  scene.remove(arcAnim.arrowHead);
  if (arcAnim.countryFlash.visible) {
    scene.remove(arcAnim.countryFlash);
  }
  
  // Dispose all Three.js resources
  arcAnim.geometry.dispose();
  arcAnim.material.dispose();
  arcAnim.arrowMaterial.dispose();
  arcAnim.countryFlash.geometry.dispose();
  arcAnim.flashMaterial.dispose();
}
```

---

## Debugging 3D Issues

### Object Not Visible Checklist

1. Check `mesh.visible` property
2. Verify material opacity > 0
3. Confirm object added to scene: `scene.children.includes(mesh)`
4. Check draw range: `geometry.drawRange`
5. Verify position is within camera view
6. Check material `side` property (THREE.DoubleSide for visibility from both sides)

### Coordinate Debugging

```javascript
console.log('[Custom Arc] Creating arc:');
console.log('  Start:', arcData.startLat.toFixed(4), arcData.startLng.toFixed(4));
console.log('  End:', arcData.endLat.toFixed(4), arcData.endLng.toFixed(4));

// Verify 3D positions
const startPoint = latLngToCartesian(arcData.startLat, arcData.startLng, 0);
console.log('  Start 3D:', startPoint.x.toFixed(2), startPoint.y.toFixed(2), startPoint.z.toFixed(2));
```

### Memory Leak Detection

```javascript
// Track object counts
console.log('Scene children:', globe.scene().children.length);
console.log('Active arcs:', animatingArcs.length);

// After clearing, counts should decrease
window.clearCustomArcs();
console.log('After clear - Scene children:', globe.scene().children.length);
```

### Browser DevTools Performance

1. Open DevTools > Performance tab
2. Record during arc animation
3. Look for:
   - JS heap growth (memory leak indicator)
   - Long frame times (> 16ms)
   - Forced reflows

See the **globe-gl** skill for Globe.GL-specific debugging techniques.
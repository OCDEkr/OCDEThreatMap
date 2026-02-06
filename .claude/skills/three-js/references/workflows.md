# Three.js Workflows Reference

## Contents
- Adding Custom 3D Objects to Globe.GL
- Performance Optimization Workflow
- Coordinate System Integration
- Animation Lifecycle Management
- Debugging 3D Issues

---

## Adding Custom 3D Objects to Globe.GL

Globe.GL wraps Three.js but exposes the scene for custom additions via `globe.scene()`.

### Workflow Checklist

Copy this checklist and track progress:
- [ ] Step 1: Get globe instance via `window.getGlobe()`
- [ ] Step 2: Access scene via `globe.scene()`
- [ ] Step 3: Create geometry with reduced segments (64 tubular, 6 radial)
- [ ] Step 4: Use `MeshBasicMaterial` (unlit) for overlay objects
- [ ] Step 5: Create mesh, set `visible = false` initially if phased
- [ ] Step 6: Add to scene via `scene.add(mesh)`
- [ ] Step 7: Track object in array for animation and cleanup
- [ ] Step 8: Implement dispose calls for ALL geometries and materials

### Example: Adding a Custom Arc

```javascript
window.addCustomArc = function(arcData) {
  if (shouldSkipArc()) return;              // Adaptive sampling
  if (animatingArcs.length >= MAX_ARCS) {   // Hard limit
    removeOldestArc();                       // Evict with full disposal
  }

  const globe = window.getGlobe();
  if (!globe) return;
  const scene = globe.scene();

  const curve = createArcCurve(arcData.startLat, arcData.startLng,
                               arcData.endLat, arcData.endLng);
  const geometry = new THREE.TubeGeometry(curve, 64, 0.3, 6, false);
  const color = COUNTRY_COLORS[arcData.countryCode] || COUNTRY_COLORS.default;
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.visible = false;  // Hidden until flash phase completes
  scene.add(mesh);

  animatingArcs.push({
    line: mesh, geometry, material, curve,
    startTime: Date.now(), duration: 2000
  });

  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(animateArcs);
  }
};
```

---

## Performance Optimization Workflow

### Progressive Quality Degradation

FPS monitoring triggers automatic quality reduction. See `public/js/performance-monitor.js`.

| Level | Pixel Ratio | Atmosphere | Max Arcs |
|-------|-------------|-----------|----------|
| 0 | 2.0 | On | 500 |
| 1 | 1.5 | On | 500 |
| 2 | 1.0 | On | 400 |
| 3 | 1.0 | Off | 300 |
| 4 | 1.0 | Off | 200 |

### Renderer Settings

```javascript
const renderer = globe.renderer();
renderer.setPixelRatio(1.5);         // Balance quality/performance
renderer.shadowMap.enabled = false;   // Shadows are expensive
renderer.setClearColor(0x000000, 1);
```

### Feedback Loop

1. Collect FPS samples over 60 frames
2. Compare average to `TARGET_FPS` (55.5) and `RECOVERY_FPS` (58.0)
3. If below target, increment degradation level
4. If above recovery, decrement degradation level
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

### Geometry Budget Reduction

Segments were reduced for performance without visible quality loss:

| Parameter | Original | Current | Savings |
|-----------|----------|---------|---------|
| `ARC_SEGMENTS` | 128 | 64 | 50% fewer triangles |
| `ARC_RADIAL_SEGMENTS` | 8 | 6 | 25% fewer triangles |
| `SphereGeometry` segments | 16,16 | 8,8 | 75% fewer triangles |
| `ConeGeometry` segments | 8 | 6 | 25% fewer triangles |
| `ARC_ANIMATION_DURATION` | 3000ms | 2000ms | Faster cleanup |

---

## Coordinate System Integration

### Globe.GL Coordinate Formula

Globe.GL uses three-globe's `polar2Cartesian`. **Critical:** theta uses `(90 - lng)`.

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

**Why This Breaks:** Arcs appear rotated 90 degrees from correct position. Source countries render in wrong locations. This is the most common coordinate bug.

**The Fix:** Use `(90 - lng)` to match Globe.GL's internal formula.

### Validating Coordinate Alignment

```javascript
// Test with known coordinates: OCDE is in Orange County, CA
const ocdePosition = latLngToCartesian(33.7490, -117.8705, 0);
console.log('OCDE position:', ocdePosition);
// Should align visually with Southern California on the globe
```

---

## Animation Lifecycle Management

### Full Arc State Object

```javascript
const arcAnimation = {
  id: `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  curve: curve,                    // QuadraticBezierCurve3
  geometry: geometry,              // TubeGeometry
  line: arcMesh,                   // Mesh (arc body)
  arrowHead: arrowMesh,           // Mesh (cone)
  countryFlash: flashMesh,        // Mesh (sphere)
  material: lineMaterial,          // For opacity animation + disposal
  arrowMaterial: arrowMaterial,    // For disposal
  flashMaterial: flashMaterial,    // For disposal
  startTime: Date.now(),
  flashDuration: 400,              // Reduced from 500ms
  arcDelay: 200,                   // Reduced from 300ms
  duration: 2000,                  // Reduced from 3000ms
  color: color,
  metadata: { sourceIP, countryCode }
};
```

### Cleanup on Completion

```javascript
function cleanupArc(arcAnim, scene) {
  scene.remove(arcAnim.line);
  scene.remove(arcAnim.arrowHead);
  if (arcAnim.countryFlash.visible) {
    scene.remove(arcAnim.countryFlash);
  }
  // Dispose ALL Three.js resources
  arcAnim.geometry.dispose();
  arcAnim.material.dispose();
  arcAnim.arrowMaterial.dispose();
  arcAnim.countryFlash.geometry.dispose();
  arcAnim.flashMaterial.dispose();
}
```

### Backward Index Removal

When removing completed arcs from an array, iterate backwards to avoid index shifting.

```javascript
for (let i = arcsToRemove.length - 1; i >= 0; i--) {
  const index = arcsToRemove[i];
  cleanupArc(animatingArcs[index], scene);
  animatingArcs.splice(index, 1);
}
```

---

## Debugging 3D Issues

### Object Not Visible Checklist

1. Check `mesh.visible` property (arcs start hidden during flash phase)
2. Verify `material.opacity > 0`
3. Confirm added to scene: `scene.children.includes(mesh)`
4. Check draw range: `geometry.drawRange` (start=0 count=Infinity is default)
5. Verify position is within camera frustum
6. For two-sided visibility: `material.side = THREE.DoubleSide`

### Memory Leak Detection

```javascript
// Monitor scene child count and active arcs
console.log('Scene children:', globe.scene().children.length);
console.log('Active arcs:', animatingArcs.length);
console.log('Arc perf:', window.getArcPerformanceStats());

// After clearing, counts should drop
window.clearCustomArcs();
console.log('After clear:', globe.scene().children.length);
```

### Browser DevTools Performance

1. Open DevTools > Performance tab
2. Record during heavy arc traffic
3. Watch for:
   - JS heap growth (memory leak from missing dispose)
   - Long frame times (> 16ms = below 60fps)
   - Geometry/material count climbing in Three.js inspector

See the **globe-gl** skill for Globe.GL-specific debugging (polygon layers, atmosphere).
See the **frontend-design** skill for CSS overlay debugging on top of the WebGL canvas.

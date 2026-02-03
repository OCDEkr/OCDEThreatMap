# Globe.GL Patterns Reference

## Contents
- Custom Arc Animation (Bypassing Built-in Arcs)
- Coordinate Conversion
- Polygon Layer Patterns
- Performance Optimization
- Anti-Patterns

---

## Custom Arc Animation (Bypassing Built-in Arcs)

Globe.GL's built-in arc system has limited animation control. This project uses custom Three.js TubeGeometry instead.

### Convert Lat/Lng to 3D Coordinates

```javascript
// Must match three-globe's exact formula
function latLngToCartesian(lat, lng, altitude = 0) {
  const GLOBE_RADIUS = 100;  // Globe.GL default
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;  // KEY: (90 - lng), NOT (lng + 180)
  const radius = GLOBE_RADIUS * (1 + altitude);

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}
```

### WARNING: Coordinate Formula Mismatch

**The Problem:**

```javascript
// BAD - Common formula from generic tutorials
const theta = (lng + 180) * Math.PI / 180;  // WRONG for Globe.GL
```

**Why This Breaks:**
1. Arcs render 180° offset from actual locations
2. Destinations appear in wrong hemisphere
3. Debugging is confusing because coordinates "look right"

**The Fix:** Use `(90 - lng)` for theta, matching three-globe's internal `polar2Cartesian`.

---

## Create Ballistic Arc Trajectory

```javascript
function createArcCurve(startLat, startLng, endLat, endLng) {
  const startPoint = latLngToCartesian(startLat, startLng, 0);
  const endPoint = latLngToCartesian(endLat, endLng, 0);

  // Euclidean midpoint, NOT spherical
  const midPoint3D = new THREE.Vector3()
    .addVectors(startPoint, endPoint)
    .multiplyScalar(0.5);

  // Scale altitude by distance
  const distance = startPoint.distanceTo(endPoint);
  const altitudeScale = Math.min(distance / (GLOBE_RADIUS * 2), 1);
  const altitude = 0.8 * altitudeScale;

  // Push midpoint radially outward for ballistic curve
  const controlPoint = midPoint3D.clone()
    .normalize()
    .multiplyScalar(GLOBE_RADIUS * (1 + altitude));

  return new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
}
```

---

## TubeGeometry for Visible Arcs

```javascript
// BAD - LineGeometry is barely visible
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, material);

// GOOD - TubeGeometry creates thick, visible arcs
const geometry = new THREE.TubeGeometry(curve, 128, 0.3, 8, false);
const mesh = new THREE.Mesh(geometry, material);
```

### Animate TubeGeometry with setDrawRange

```javascript
// TubeGeometry uses indexed triangles, not simple vertices
const radialSegments = 8;  // Must match TubeGeometry constructor
const trianglesPerSegment = radialSegments * 2;
const indicesPerSegment = trianglesPerSegment * 3;

const drawStart = Math.floor(segmentStart * ARC_SEGMENTS * indicesPerSegment);
const drawCount = Math.ceil(segmentLength * ARC_SEGMENTS * indicesPerSegment);
geometry.setDrawRange(drawStart, drawCount);
```

---

## Polygon Layer Patterns

### Overlay Multiple Polygon Sets

```javascript
// Add state borders over country borders
const existingPolygons = globeInstance.polygonsData();
globeInstance.polygonsData([
  ...existingPolygons,
  ...states.features.map(f => ({ ...f, isState: true }))
])
.polygonAltitude(d => d.isState ? 0.012 : 0.01)
.polygonStrokeColor(d => d.isState ? '#ffa500' : '#00ffff');
```

### Custom Labels with HTML

```javascript
.polygonLabel(({ properties: d }) => `
  <div style="background: rgba(0,0,0,0.9); padding: 3px 6px; border: 1px solid #00ffff;">
    <b>${d.ADMIN || d.NAME}</b>
  </div>
`)
```

---

## Performance Optimization

### Renderer Settings

```javascript
const renderer = globeInstance.renderer();
renderer.setPixelRatio(1.5);          // Balance quality/perf
renderer.shadowMap.enabled = false;   // Shadows are expensive
renderer.setClearColor(0x000000, 1);
```

### Progressive Quality Degradation

```javascript
// Degrade based on FPS (see performance-monitor.js)
switch(degradationLevel) {
  case 0: renderer.setPixelRatio(2.0); globe.showAtmosphere(true); break;
  case 2: renderer.setPixelRatio(1.0); globe.showAtmosphere(true); break;
  case 4: renderer.setPixelRatio(1.0); globe.showAtmosphere(false); break;
}
```

---

## Anti-Patterns

### WARNING: Forgetting to Dispose Geometries

**The Problem:**

```javascript
// BAD - Memory leak
scene.remove(arcMesh);
// Geometry and material still in GPU memory
```

**Why This Breaks:** WebGL resources accumulate. After hundreds of arcs, GPU memory exhausts, causing crashes or severe slowdown.

**The Fix:**

```javascript
scene.remove(arcMesh);
arcMesh.geometry.dispose();
arcMesh.material.dispose();
```

### WARNING: Using Globe.GL Arcs for Complex Animation

**The Problem:**

```javascript
// Limited control over animation timing and appearance
globeInstance.arcsData(arcs)
  .arcDashAnimateTime(1500);  // Can't control mid-flight behavior
```

**Why This Breaks:**
1. No per-arc animation state
2. Can't create "traveling segment" effect
3. Fade behavior is global, not per-arc

**The Fix:** Use custom Three.js arcs via `scene.add()` for full control.
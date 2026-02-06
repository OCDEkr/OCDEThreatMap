# Globe.GL Patterns Reference

## Contents
- Custom Arc Animation (Bypassing Built-in Arcs)
- Coordinate Conversion
- TubeGeometry for Visible Arcs
- Polygon Layer Patterns
- Country Color Mapping
- Performance Optimization
- Anti-Patterns

---

## Custom Arc Animation (Bypassing Built-in Arcs)

Globe.GL's built-in arc system offers no per-arc animation state, no traveling-segment effect, and no per-arc fade control. This project bypasses it entirely by injecting Three.js meshes directly into `globeInstance.scene()`.

Arc entry point: `public/js/arcs.js:46` calls `window.addCustomArc()` from `public/js/custom-arcs.js:271`.

---

## Coordinate Conversion

### Convert Lat/Lng to 3D Cartesian (Globe.GL's System)

```javascript
// Must match three-globe's exact polar2Cartesian formula
const GLOBE_RADIUS = 100;  // Globe.GL default radius

function latLngToCartesian(lat, lng, altitude = 0) {
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
// BAD - Common formula from generic Three.js/WebGL tutorials
const theta = (lng + 180) * Math.PI / 180;
```

**Why This Breaks:**
1. Arcs render 180 degrees offset from actual locations on the globe
2. Destinations appear in the wrong hemisphere
3. Extremely confusing to debug because the math "looks right" in isolation

**The Fix:** Use `(90 - lng)` for theta. This matches three-globe's internal `polar2Cartesian` function. Source: `three-globe/src/utils/coordTranslate.js`.

**When You Might Be Tempted:** Any tutorial or StackOverflow answer about "lat/lng to 3D sphere" will use the standard formula. Globe.GL uses a non-standard coordinate system.

---

## TubeGeometry for Visible Arcs

### DO: Use TubeGeometry for Thick, Visible Arcs

```javascript
// GOOD - Visible on NOC displays from 20+ feet
const geometry = new THREE.TubeGeometry(curve, 64, 0.3, 6, false);
const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

### DON'T: Use Line/LineBasicMaterial

```javascript
// BAD - Barely visible, ~1px regardless of zoom
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
```

**Why:** LineBasicMaterial renders at 1px on most GPUs regardless of `linewidth`. TubeGeometry creates actual 3D geometry visible at any distance. See the **three-js** skill for geometry details.

### Animate TubeGeometry with setDrawRange

```javascript
// TubeGeometry uses indexed triangles, not simple vertex lists
const ARC_SEGMENTS = 64;
const ARC_RADIAL_SEGMENTS = 6;
const trianglesPerSegment = ARC_RADIAL_SEGMENTS * 2;
const indicesPerSegment = trianglesPerSegment * 3;

// Show traveling segment (segmentStart to segmentEnd as 0-1 progress)
const drawStart = Math.floor(segmentStart * ARC_SEGMENTS * indicesPerSegment);
const drawCount = Math.ceil((segmentEnd - segmentStart) * ARC_SEGMENTS * indicesPerSegment);
geometry.setDrawRange(drawStart, drawCount);
```

### Create Ballistic Arc Trajectory

```javascript
function createArcCurve(startLat, startLng, endLat, endLng) {
  const startPoint = latLngToCartesian(startLat, startLng, 0);
  const endPoint = latLngToCartesian(endLat, endLng, 0);

  // Euclidean midpoint (NOT spherical interpolation)
  const midPoint3D = new THREE.Vector3()
    .addVectors(startPoint, endPoint).multiplyScalar(0.5);

  // Scale altitude by distance
  const distance = startPoint.distanceTo(endPoint);
  const altitudeScale = Math.min(distance / (GLOBE_RADIUS * 2), 1);

  // Push midpoint radially outward for ballistic curve
  const controlPoint = midPoint3D.clone()
    .normalize()
    .multiplyScalar(GLOBE_RADIUS * (1 + 0.8 * altitudeScale));

  return new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
}
```

---

## Polygon Layer Patterns

### Overlay Multiple Polygon Sets

```javascript
// public/js/globe.js:206 — Add US states over country borders
const existingPolygons = globeInstance.polygonsData();
const stateFeatures = states.features.map(f => ({ ...f, isState: true }));

globeInstance
  .polygonsData([...existingPolygons, ...stateFeatures])
  .polygonAltitude(d => d.isState ? 0.012 : 0.01)  // States slightly above countries
  .polygonCapColor(d => d.isState ? 'rgba(255,255,255,0.02)' : 'rgba(0,50,100,0.02)')
  .polygonStrokeColor(() => '#ffffff');
```

### Custom HTML Labels

```javascript
.polygonLabel(({ properties: d, isState }) => `
  <div style="background: rgba(0,0,0,0.9); padding: 3px 6px;
    border: 1px solid #ffffff; border-radius: 3px;">
    <b>${isState ? d.name : (d.ADMIN || d.NAME)}</b>
  </div>
`)
```

**Note:** GeoJSON property names differ between datasets. Natural Earth uses `ADMIN`/`NAME`; US Atlas uses `name`.

---

## Country Color Mapping

Arc colors are based on country code, not threat type. Defined in `public/js/custom-arcs.js:38-90`.

```javascript
// Regional grouping for NOC visibility
const COUNTRY_COLORS = {
  CN: 0xff0000,    // China - Red (Asia warm colors)
  DE: 0x00ccff,    // Germany - Cyan (Europe cool colors)
  US: 0x00ff00,    // USA - Green (Americas)
  NG: 0x9900ff,    // Nigeria - Purple (Africa/Middle East)
  AU: 0xffff00,    // Australia - Yellow (Oceania)
  default: 0xffa500 // Orange fallback
};
```

Exposed globally as `window.getCountryColorHex(countryCode)` for use by stats panels and event log.

**IMPORTANT:** `COUNTRY_COLORS` exists in TWO files — `custom-arcs.js` (hex int: `0xff0000`) and `flat-map-d3.js` (hex string: `'#ff0000'`). Keep both in sync when adding or changing colors. See the **d3** skill.

---

## Performance Optimization

### Renderer Settings (from globe.js:97-100)

```javascript
renderer.setPixelRatio(1.5);          // Balance quality vs performance
renderer.shadowMap.enabled = false;   // Shadows never needed for this visualization
renderer.setClearColor(0x000000, 1);  // Black background
```

### Progressive Quality Degradation (performance-monitor.js)

```javascript
// FPS-adaptive: degrade pixelRatio and disable atmosphere when FPS drops
switch(degradationLevel) {
  case 0: renderer.setPixelRatio(2.0); globe.showAtmosphere(true); break;
  case 2: renderer.setPixelRatio(1.0); globe.showAtmosphere(true); break;
  case 4: renderer.setPixelRatio(1.0); globe.showAtmosphere(false); break;
}
```

### Adaptive Arc Sampling (custom-arcs.js:241-260)

When volume exceeds 100 arcs/second, only 1 in 10 arcs renders. Hard cap at 150 concurrent arcs. Oldest arcs are evicted when the cap is reached.

---

## Anti-Patterns

### WARNING: Forgetting to Dispose Geometries and Materials

**The Problem:**

```javascript
// BAD - Memory leak
scene.remove(arcMesh);
// Geometry and material still in GPU memory
```

**Why This Breaks:** `scene.remove()` only detaches the mesh from the scene graph. The geometry and material remain allocated in GPU memory. After hundreds of arcs, GPU memory exhausts causing severe frame drops or tab crashes.

**The Fix:**

```javascript
scene.remove(arcMesh);
arcMesh.geometry.dispose();
arcMesh.material.dispose();
// Also dispose arrow heads, flash effects — ALL created geometries
```

**When You Might Be Tempted:** Thinking `scene.remove()` is equivalent to deletion. It is not. See the **three-js** skill for full disposal patterns.

### WARNING: Using Globe.GL's Built-in Arc System for Complex Animation

**The Problem:**

```javascript
// Limited — can't control per-arc timing or traveling segment
globeInstance.arcsData(arcs).arcDashAnimateTime(1500);
```

**Why This Breaks:**
1. No per-arc animation state — all arcs share global timing
2. No traveling-segment effect (visible portion moving along path)
3. No phased animation (flash at origin, then arc travels, then fade)
4. Removing one arc triggers full re-render of all arcs

**The Fix:** Use custom Three.js meshes added directly to `globeInstance.scene()`. See the **three-js** skill for geometry creation patterns.

### WARNING: Using Full devicePixelRatio

**The Problem:**

```javascript
// BAD on Retina/4K displays
renderer.setPixelRatio(window.devicePixelRatio);
```

**Why This Breaks:** On a 4K display, `devicePixelRatio` is 2.0+, meaning 4x the pixels to render. With 150 animated arcs, arrow heads, and flash effects, this tanks FPS below 30 on most GPUs.

**The Fix:** Cap at 1.5: `renderer.setPixelRatio(1.5)`. Let performance-monitor.js degrade further if needed.

**When You Might Be Tempted:** When text or edges look blurry on high-DPI screens. The 1.5 cap is a deliberate tradeoff for this visualization's arc-heavy workload.

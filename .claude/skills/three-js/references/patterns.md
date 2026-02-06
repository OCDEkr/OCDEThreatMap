# Three.js Patterns Reference

## Contents
- Geometry Patterns
- Material Patterns
- Animation Patterns
- Scene Integration
- Memory Management
- Adaptive Sampling

---

## Geometry Patterns

### TubeGeometry for Visible Arcs

Globe.GL's built-in arcs use `LineSegments` which are nearly invisible at most zoom levels. This project uses `TubeGeometry` for volumetric arcs.

```javascript
// GOOD - TubeGeometry creates visible volumetric arcs
const geometry = new THREE.TubeGeometry(
  curve,  // QuadraticBezierCurve3 path
  64,     // tubularSegments (reduced from 128 for performance)
  0.3,    // radius (thickness)
  6,      // radialSegments (reduced from 8 for performance)
  false   // closed
);
const mesh = new THREE.Mesh(geometry, material);
```

```javascript
// BAD - LineBasicMaterial too thin at globe zoom distances
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
```

**Why TubeGeometry:** Lines in WebGL render at 1px regardless of distance. TubeGeometry creates actual 3D tubes that scale properly with zoom.

### Partial Geometry Rendering with setDrawRange

Animate "traveling" arcs by controlling which triangle indices render.

```javascript
// TubeGeometry uses indexed rendering — work with triangle indices, not vertices
const trianglesPerSegment = ARC_RADIAL_SEGMENTS * 2;  // 6 * 2 = 12
const indicesPerSegment = trianglesPerSegment * 3;     // 12 * 3 = 36

const drawStart = Math.floor(segmentStart * ARC_SEGMENTS * indicesPerSegment);
const drawCount = Math.ceil((segmentEnd - segmentStart) * ARC_SEGMENTS * indicesPerSegment);
geometry.setDrawRange(drawStart, drawCount);
```

### Arrow Heads with ConeGeometry

Orient cones along arc tangent using quaternion rotation from default "up" vector.

```javascript
function createArrowHead(position, direction, color) {
  const geometry = new THREE.ConeGeometry(1.5, 4.5, 6);  // 6 segments (not 8)
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(position);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),  // Cone default "up" axis
    direction.normalize()
  );
  return mesh;
}
```

### Country Flash with SphereGeometry

```javascript
function createCountryFlash(lat, lng, color) {
  const position = latLngToCartesian(lat, lng, 0.02);  // Slight altitude offset
  const geometry = new THREE.SphereGeometry(3, 8, 8);   // 8 segments (not 16)
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  return mesh;
}
```

---

## Material Patterns

### WARNING: MeshPhongMaterial Specular Highlights

**The Problem:**

```javascript
// BAD - Creates distracting specular "dot" on globe
new THREE.MeshPhongMaterial({ color: 0x0d47a1, shininess: 50 })
```

**Why This Breaks:** Globe surfaces with default MeshPhongMaterial produce bright specular dots that distract from arc visualization and look wrong on NOC displays.

**The Fix:**

```javascript
// GOOD - Matte appearance for globe surface (globe.js:37-44)
new THREE.MeshPhongMaterial({
  color: 0x0d47a1,
  emissive: 0x1976d2,
  emissiveIntensity: 0.2,
  shininess: 0,
  specular: 0x000000
})
```

### MeshBasicMaterial for Unlit Objects

Arcs, arrows, and flash effects must be visible regardless of scene lighting. NEVER use lit materials for overlay objects.

```javascript
// Arcs use country-based colors (not threat-type colors)
const color = COUNTRY_COLORS[countryCode] || COUNTRY_COLORS.default;
const material = new THREE.MeshBasicMaterial({
  color: color,
  transparent: true,
  opacity: 1.0
});
```

---

## Animation Patterns

### Conditional Animation Loop

```javascript
// GOOD - Stops when nothing to animate (custom-arcs.js:499-503)
let animationFrameId = null;

function animateArcs() {
  // ... update logic ...
  if (animatingArcs.length > 0) {
    animationFrameId = requestAnimationFrame(animateArcs);
  } else {
    animationFrameId = null;  // Release the loop
  }
}

// Start only when needed
if (!animationFrameId) {
  animationFrameId = requestAnimationFrame(animateArcs);
}
```

### WARNING: Animation Without Cleanup

**The Problem:**

```javascript
// BAD - Runs forever, wastes CPU even with zero arcs
requestAnimationFrame(function animate() {
  updateArcs();
  requestAnimationFrame(animate);
});
```

**Why This Breaks:** Without conditional termination, the animation loop consumes CPU indefinitely. On a NOC display running 24/7, this degrades performance during idle periods.

### Phased Animation (Flash then Delay then Arc then Fade)

```javascript
// Phase 1: Country flash pulse (0ms to flashDuration)
if (elapsed < arc.flashDuration) {
  const pulse = Math.sin((elapsed / arc.flashDuration) * Math.PI * 4);
  arc.countryFlash.scale.setScalar(1 + pulse * 0.5);
  return;
}

// Phase 2: Transition delay (flashDuration to flashDuration + arcDelay)
if (elapsed < arc.flashDuration + arc.arcDelay) {
  arc.line.visible = true;
  arc.arrowHead.visible = true;
  return;
}

// Phase 3: Arc travel animation
const arcElapsed = elapsed - arc.flashDuration - arc.arcDelay;
const progress = Math.min(arcElapsed / arc.duration, 1);
// ... setDrawRange and arrow position updates

// Phase 4: Fade out after completion
if (progress >= 1) {
  const fadeProgress = Math.min((arcElapsed - arc.duration) / 500, 1);
  arc.material.opacity = (1 - fadeProgress) * 0.9;
}
```

---

## Scene Integration

### Accessing Globe.GL's Three.js Objects

```javascript
const globe = window.getGlobe();
const scene = globe.scene();
const renderer = globe.renderer();
const camera = globe.camera();

scene.add(customMesh);
```

### WARNING: Background Color Override

**The Problem:**

```javascript
// BAD - Globe.GL may override renderer clear color
renderer.setClearColor(0x000000, 1);
```

**The Fix:**

```javascript
// GOOD - Set both renderer AND scene background (globe.js:100-106)
renderer.setClearColor(0x000000, 1);
scene.background = new THREE.Color(0x000000);
```

---

## Memory Management

### WARNING: Forgetting to Dispose

**The Problem:**

```javascript
// BAD - GPU memory leak
scene.remove(mesh);
// Geometry and material still consume GPU memory
```

**Why This Breaks:** At 100+ arcs/second, each arc creates geometry + 2 materials + arrow geometry + flash geometry. Without disposal, GPU memory bloats to gigabytes within minutes.

**The Fix:**

```javascript
// GOOD - Full disposal pattern (custom-arcs.js:476-496)
scene.remove(arc.line);
scene.remove(arc.arrowHead);
if (arc.countryFlash.visible) scene.remove(arc.countryFlash);

arc.geometry.dispose();
arc.material.dispose();
arc.arrowMaterial.dispose();
arc.countryFlash.geometry.dispose();
arc.flashMaterial.dispose();
```

---

## Adaptive Sampling

High-volume traffic (100+ arcs/second) overwhelms WebGL. The codebase uses adaptive sampling.

```javascript
// Skip rendering most arcs when volume exceeds threshold
const HIGH_VOLUME_THRESHOLD = 100;  // arcs/second
const SAMPLE_RATE_HIGH_VOLUME = 10; // show 1 in 10

function shouldSkipArc() {
  if (arcsAddedLastSecond > HIGH_VOLUME_THRESHOLD) {
    return (sampleCounter % SAMPLE_RATE_HIGH_VOLUME) !== 0;
  }
  return false;
}
```

Also enforces hard cap: `MAX_ARCS = 150` concurrent. When exceeded, oldest arc is removed with full disposal.

See the **globe-gl** skill for Globe.GL-level performance settings (atmosphere, polygon rendering).

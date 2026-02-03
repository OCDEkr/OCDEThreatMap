# Three.js Patterns Reference

## Contents
- Geometry Patterns
- Material Patterns
- Animation Patterns
- Scene Integration
- Memory Management

---

## Geometry Patterns

### TubeGeometry for Visible Arcs

Globe.GL's built-in arcs use `LineSegments` which render thin at most zoom levels. Use `TubeGeometry` for consistently visible arcs.

```javascript
// GOOD - TubeGeometry creates volumetric arcs
const geometry = new THREE.TubeGeometry(
  curve,      // Path curve
  128,        // tubularSegments (smoothness)
  0.3,        // radius (thickness)
  8,          // radialSegments
  false       // closed
);
const mesh = new THREE.Mesh(geometry, material);
```

```javascript
// BAD - LineBasicMaterial too thin at distance
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
```

### Partial Geometry Rendering with setDrawRange

Animate "traveling" arcs by controlling which portion of geometry renders.

```javascript
// TubeGeometry uses indexed rendering
const radialSegments = 8;  // Must match TubeGeometry constructor
const trianglesPerSegment = radialSegments * 2;
const indicesPerSegment = trianglesPerSegment * 3;

const drawStart = Math.floor(segmentStart * ARC_SEGMENTS * indicesPerSegment);
const drawCount = Math.ceil((segmentEnd - segmentStart) * ARC_SEGMENTS * indicesPerSegment);

geometry.setDrawRange(drawStart, drawCount);
```

### Arrow Head with ConeGeometry

```javascript
function createArrowHead(position, direction, color) {
  const geometry = new THREE.ConeGeometry(1.5, 4.5, 8);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
  const mesh = new THREE.Mesh(geometry, material);
  
  mesh.position.copy(position);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),  // Cone default "up"
    direction.normalize()
  );
  return mesh;
}
```

---

## Material Patterns

### WARNING: MeshPhongMaterial Specular Highlights

**The Problem:**

```javascript
// BAD - Creates distracting specular "dot" on globe
new THREE.MeshPhongMaterial({
  color: 0x0d47a1,
  shininess: 50  // Default creates specular reflection
})
```

**Why This Breaks:** Globe surfaces with default MeshPhongMaterial show bright specular dots that distract from arc visualization and look unrealistic for NOC displays.

**The Fix:**

```javascript
// GOOD - Disable specular for matte appearance
new THREE.MeshPhongMaterial({
  color: 0x0d47a1,
  emissive: 0x1976d2,
  emissiveIntensity: 0.2,
  shininess: 0,         // No specular highlight
  specular: 0x000000    // Black specular = none
})
```

### MeshBasicMaterial for Unlit Objects

Use `MeshBasicMaterial` for objects that should ignore scene lighting (arcs, indicators).

```javascript
// Arcs should be consistently visible regardless of lighting
const material = new THREE.MeshBasicMaterial({
  color: THREAT_COLORS[threatType],
  transparent: true,
  opacity: 1.0
});
```

---

## Animation Patterns

### Frame-Based Animation with Progress

```javascript
function animateArcs() {
  const now = Date.now();
  
  animatingArcs.forEach(arc => {
    const elapsed = now - arc.startTime;
    const progress = Math.min(elapsed / arc.duration, 1);
    
    if (progress < 1) {
      // Update arc based on progress (0-1)
      const position = arc.curve.getPoint(progress);
      const direction = arc.curve.getTangent(progress);
      arc.arrowHead.position.copy(position);
    }
  });
  
  requestAnimationFrame(animateArcs);
}
```

### Phased Animation (Flash then Arc)

```javascript
const FLASH_DURATION = 500;
const ARC_DELAY = 300;

function animateWithPhases(arc) {
  const elapsed = Date.now() - arc.startTime;
  
  // Phase 1: Country flash (0-500ms)
  if (elapsed < FLASH_DURATION) {
    const flashProgress = elapsed / FLASH_DURATION;
    const pulse = Math.sin(flashProgress * Math.PI * 4);
    arc.flash.scale.setScalar(1 + pulse * 0.5);
    return;
  }
  
  // Phase 2: Delay before arc (500-800ms)
  if (elapsed < FLASH_DURATION + ARC_DELAY) {
    arc.line.visible = true;
    return;
  }
  
  // Phase 3: Arc animation
  const arcElapsed = elapsed - FLASH_DURATION - ARC_DELAY;
  const progress = arcElapsed / arc.duration;
  // ... animate arc
}
```

### WARNING: Animation Without Cleanup

**The Problem:**

```javascript
// BAD - Memory leak, animation runs forever
requestAnimationFrame(function animate() {
  updateArcs();
  requestAnimationFrame(animate);
});
```

**Why This Breaks:** Without tracking and cancellation, animations continue even when no objects exist, wasting CPU cycles and preventing garbage collection.

**The Fix:**

```javascript
// GOOD - Conditional animation loop
let animationFrameId = null;

function animate() {
  if (animatingArcs.length === 0) {
    animationFrameId = null;
    return;  // Stop when nothing to animate
  }
  updateArcs();
  animationFrameId = requestAnimationFrame(animate);
}

// Start only when needed
if (!animationFrameId && animatingArcs.length > 0) {
  animationFrameId = requestAnimationFrame(animate);
}
```

---

## Scene Integration

### Accessing Globe.GL's Three.js Scene

```javascript
// Globe.GL exposes underlying Three.js objects
const globe = window.getGlobe();
const scene = globe.scene();
const renderer = globe.renderer();
const camera = globe.camera();

// Add custom objects to scene
scene.add(customMesh);
```

### WARNING: Direct Scene Background Modification

**The Problem:**

```javascript
// BAD - Setting clear color alone may not work
renderer.setClearColor(0x000000, 1);
```

**Why This Breaks:** Globe.GL may override renderer settings. The scene background property takes precedence.

**The Fix:**

```javascript
// GOOD - Set both renderer and scene background
renderer.setClearColor(0x000000, 1);
const scene = globe.scene();
scene.background = new THREE.Color(0x000000);
```

---

## Memory Management

### Proper Disposal Pattern

```javascript
function removeArc(arcAnimation, scene) {
  // 1. Remove from scene
  scene.remove(arcAnimation.line);
  scene.remove(arcAnimation.arrowHead);
  scene.remove(arcAnimation.countryFlash);
  
  // 2. Dispose geometries
  arcAnimation.geometry.dispose();
  arcAnimation.arrowHead.geometry.dispose();
  arcAnimation.countryFlash.geometry.dispose();
  
  // 3. Dispose materials
  arcAnimation.material.dispose();
  arcAnimation.arrowMaterial.dispose();
  arcAnimation.flashMaterial.dispose();
}
```

### WARNING: Forgetting to Dispose

**The Problem:**

```javascript
// BAD - Memory leak
scene.remove(mesh);
// Geometry and material still in GPU memory
```

**Why This Breaks:** Three.js objects persist in GPU memory until explicitly disposed. In high-frequency arc creation (100+ per minute), this causes severe memory bloat.

**The Fix:**

```javascript
// GOOD - Always dispose after removing
scene.remove(mesh);
mesh.geometry.dispose();
mesh.material.dispose();
```

### Bulk Cleanup Function

```javascript
window.clearCustomArcs = function() {
  const scene = globeInstance.scene();
  
  animatingArcs.forEach(arc => {
    scene.remove(arc.line);
    scene.remove(arc.arrowHead);
    arc.geometry.dispose();
    arc.material.dispose();
    arc.arrowMaterial.dispose();
  });
  
  animatingArcs = [];
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};
```
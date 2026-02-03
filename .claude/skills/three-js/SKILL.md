---
name: three-js
description: |
  Manages Three.js 3D rendering engine and WebGL visualization.
  Use when: Working with 3D geometry, materials, animations, scene management,
  coordinate transforms, or renderer optimization in the globe visualization.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Three.js Skill

Three.js powers the custom arc animations and 3D geometry in this project. Globe.GL handles globe rendering, but custom Three.js code manages animated arcs, arrow heads, country flash effects, and scene manipulation. The codebase uses browser IIFE patterns exposing functions to `window` scope.

## Quick Start

### Creating 3D Geometry

```javascript
// TubeGeometry for thick visible arcs
const geometry = new THREE.TubeGeometry(curve, 128, 0.3, 8, false);
const material = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 1.0
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

### Coordinate Conversion (Lat/Lng to 3D)

```javascript
// Globe.GL uses three-globe's polar2Cartesian formula
function latLngToCartesian(lat, lng, altitude = 0) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (90 - lng) * Math.PI / 180;  // KEY: (90 - lng), not (lng + 180)
  const radius = GLOBE_RADIUS * (1 + altitude);
  
  const phiSin = Math.sin(phi);
  return new THREE.Vector3(
    radius * phiSin * Math.cos(theta),
    radius * Math.cos(phi),
    radius * phiSin * Math.sin(theta)
  );
}
```

### Bezier Curves for Arc Trajectories

```javascript
// Quadratic Bezier for ballistic missile-style arcs
const startPoint = latLngToCartesian(startLat, startLng, 0);
const endPoint = latLngToCartesian(endLat, endLng, 0);
const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
const controlPoint = midPoint.normalize().multiplyScalar(GLOBE_RADIUS * 1.5);

const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Scene access | Via Globe.GL | `globeInstance.scene()` |
| Renderer access | Via Globe.GL | `globeInstance.renderer()` |
| Draw range | Partial geometry | `geometry.setDrawRange(start, count)` |
| Dispose | Memory cleanup | `geometry.dispose(); material.dispose()` |
| requestAnimationFrame | Animation loop | `requestAnimationFrame(animate)` |

## Common Patterns

### Animation Loop with Cleanup

**When:** Managing multiple animated objects with lifecycle

```javascript
let animatingArcs = [];
let animationFrameId = null;

function animateArcs() {
  const arcsToRemove = [];
  
  animatingArcs.forEach((arc, index) => {
    const progress = (Date.now() - arc.startTime) / arc.duration;
    if (progress >= 1) {
      arcsToRemove.push(index);
    } else {
      // Update arc position/appearance
    }
  });
  
  // Remove backwards to avoid index shifting
  for (let i = arcsToRemove.length - 1; i >= 0; i--) {
    const arc = animatingArcs[arcsToRemove[i]];
    scene.remove(arc.mesh);
    arc.geometry.dispose();
    arc.material.dispose();
    animatingArcs.splice(arcsToRemove[i], 1);
  }
  
  if (animatingArcs.length > 0) {
    animationFrameId = requestAnimationFrame(animateArcs);
  } else {
    animationFrameId = null;
  }
}
```

## See Also

- [patterns](references/patterns.md) - Geometry, materials, animation patterns
- [workflows](references/workflows.md) - Scene setup, performance optimization

## Related Skills

- See the **globe-gl** skill for Globe.GL-specific configuration and API
- See the **d3** skill for the alternative 2D flat map visualization
- See the **frontend-design** skill for CSS integration with 3D overlays
---
name: globe-gl
description: |
  Renders 3D WebGL globes with animated arcs and country borders.
  Use when: configuring globe visualization, adding arc animations, managing globe state, or optimizing 3D rendering performance.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Globe.GL Skill

Globe.GL wraps Three.js to render interactive 3D globes. This project uses Globe.GL for real-time attack visualization with custom arc animations, polygon country borders, and performance-aware rendering.

**Key architectural decision:** This codebase bypasses Globe.GL's built-in arc system in favor of custom Three.js TubeGeometry arcs for better animation control.

## Quick Start

### Initialize Globe with Custom Styling

```javascript
// public/js/globe.js - IIFE pattern for browser globals
globeInstance = Globe()(container)
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
  .globeMaterial(new THREE.MeshPhongMaterial({
    color: 0x0d47a1,
    emissive: 0x1976d2,
    emissiveIntensity: 0.2,
    shininess: 0,
    specular: 0x000000  // Removes specular dot
  }))
  .showAtmosphere(true)
  .atmosphereColor('#00ffff')
  .pointOfView({ lat: 33.7490, lng: -117.8705, altitude: 2.5 });
```

### Add Polygon Layers (Countries)

```javascript
fetch('https://raw.githubusercontent.com/.../ne_110m_admin_0_countries.geojson')
  .then(res => res.json())
  .then(countries => {
    globeInstance
      .polygonsData(countries.features)
      .polygonAltitude(0.01)
      .polygonCapColor(() => 'rgba(0, 100, 200, 0.05)')
      .polygonStrokeColor(() => '#00ffff');
  });
```

### Access Three.js Internals

```javascript
const renderer = globeInstance.renderer();
renderer.setPixelRatio(1.5);
renderer.shadowMap.enabled = false;

const scene = globeInstance.scene();
scene.background = new THREE.Color(0x000000);
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Chained API | All setters return the instance | `.showAtmosphere(true).atmosphereColor('#fff')` |
| Data layers | polygons, arcs, points, labels | `.polygonsData(features)` |
| Point of view | Camera position in lat/lng/alt | `.pointOfView({ lat, lng, altitude })` |
| Scene access | Direct Three.js manipulation | `globeInstance.scene()` |
| Renderer access | WebGL config | `globeInstance.renderer()` |

## Common Patterns

### Smooth Camera Animation

```javascript
globeInstance.pointOfView({
  lat: 39.8283,
  lng: -98.5795,
  altitude: 1.5
}, 1000);  // 1 second animation duration
```

### Continuous Rotation

```javascript
function animate() {
  const currentView = globeInstance.pointOfView();
  globeInstance.pointOfView({
    lat: currentView.lat,
    lng: (currentView.lng + 0.2) % 360,
    altitude: currentView.altitude
  }, 0);  // 0 = no transition for smooth rotation
  requestAnimationFrame(animate);
}
```

## See Also

- [patterns](references/patterns.md) - Arc creation, polygon layers, performance tuning
- [workflows](references/workflows.md) - Full initialization, animation loops, cleanup

## Related Skills

For Three.js fundamentals and coordinate math, see the **three-js** skill.
For performance monitoring that triggers quality degradation, see the **frontend-design** skill.
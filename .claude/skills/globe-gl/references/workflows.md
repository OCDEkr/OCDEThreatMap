# Globe.GL Workflows Reference

## Contents
- Full Globe Initialization
- Arc Lifecycle Management
- View Switching (Globe/Flat Map)
- Cleanup and Disposal

---

## Full Globe Initialization

Copy this checklist and track progress:
- [ ] Step 1: Check Globe library loaded from CDN
- [ ] Step 2: Create globe instance with container
- [ ] Step 3: Configure material and atmosphere
- [ ] Step 4: Load GeoJSON country borders
- [ ] Step 5: Configure renderer settings
- [ ] Step 6: Set initial empty arc data

### Complete Initialization Pattern

```javascript
window.initGlobe = function(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  // Step 1: Verify CDN loaded
  if (typeof Globe === 'undefined') {
    console.error('Globe.GL not loaded');
    return null;
  }

  // Step 2-3: Create and configure
  const globe = Globe()(container)
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .showAtmosphere(true)
    .atmosphereColor('#00ffff')
    .pointOfView({ lat: 33.7490, lng: -117.8705, altitude: 2.5 });

  // Step 4: Load borders asynchronously
  fetch('https://...geojson')
    .then(res => res.json())
    .then(countries => {
      globe.polygonsData(countries.features)
        .polygonStrokeColor(() => '#00ffff');
    })
    .catch(err => console.warn('Borders failed:', err));

  // Step 5: Renderer config
  const renderer = globe.renderer();
  renderer.setPixelRatio(1.5);
  renderer.shadowMap.enabled = false;

  // Step 6: Initialize empty arcs
  globe.arcsData([]);

  return globe;
};
```

---

## Arc Lifecycle Management

### Create → Animate → Cleanup Flow

```javascript
function addCustomArc(arcData) {
  const globe = window.getGlobe();
  const scene = globe.scene();

  // 1. Create geometry and mesh
  const curve = createArcCurve(arcData.startLat, arcData.startLng,
                                arcData.endLat, arcData.endLng);
  const geometry = new THREE.TubeGeometry(curve, 128, 0.3, 8, false);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);

  // 2. Add to scene
  scene.add(mesh);

  // 3. Track for animation
  animatingArcs.push({
    mesh, geometry, material, curve,
    startTime: Date.now(),
    duration: 3000
  });

  // 4. Start animation loop if needed
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(animateArcs);
  }
}
```

### Animation Loop with Cleanup

```javascript
function animateArcs() {
  const now = Date.now();
  const arcsToRemove = [];

  animatingArcs.forEach((arc, index) => {
    const elapsed = now - arc.startTime;
    const progress = elapsed / arc.duration;

    if (progress >= 1) {
      // Mark for removal
      arcsToRemove.push(index);
    } else {
      // Update draw range for traveling effect
      updateArcProgress(arc, progress);
    }
  });

  // Remove completed arcs (iterate backwards!)
  for (let i = arcsToRemove.length - 1; i >= 0; i--) {
    const arc = animatingArcs[arcsToRemove[i]];
    scene.remove(arc.mesh);
    arc.geometry.dispose();
    arc.material.dispose();
    animatingArcs.splice(arcsToRemove[i], 1);
  }

  // Continue or stop loop
  if (animatingArcs.length > 0) {
    animationFrameId = requestAnimationFrame(animateArcs);
  } else {
    animationFrameId = null;
  }
}
```

### Iterate-Until-Done Pattern

1. Create arc and add to scene
2. Push to tracking array with timestamp
3. In animation loop: update progress
4. If progress >= 1, add to removal list
5. After loop iteration, dispose and splice removed arcs
6. Repeat until all arcs complete

---

## View Switching (Globe/Flat Map)

```javascript
let currentViewMode = 'globe';

window.toggleView = function() {
  if (currentViewMode === 'globe') {
    // Hide globe
    document.getElementById('globe').style.display = 'none';

    // Initialize and start flat map
    window.initFlatMap();
    window.startFlatMap();

    currentViewMode = 'flat';
  } else {
    // Stop flat map
    window.stopFlatMap();

    // Show globe
    document.getElementById('globe').style.display = 'block';

    currentViewMode = 'globe';
  }
  return currentViewMode;
};
```

---

## Continuous Rotation Workflow

```javascript
let rotationAnimationId = null;
let isRotating = false;

window.startGlobeRotation = function() {
  if (isRotating) return;

  // Center first
  globeInstance.pointOfView({
    lat: 39.8283, lng: -98.5795, altitude: 2.5
  }, 1000);

  // Start rotation after animation
  setTimeout(() => {
    isRotating = true;
    const rotationSpeed = 0.2;  // degrees per frame

    function animate() {
      if (!isRotating) return;

      const current = globeInstance.pointOfView();
      globeInstance.pointOfView({
        lat: current.lat,
        lng: (current.lng + rotationSpeed) % 360,
        altitude: current.altitude
      }, 0);

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

---

## Full Cleanup Workflow

Copy this checklist for cleanup:
- [ ] Cancel all animation frames
- [ ] Remove all custom meshes from scene
- [ ] Dispose all geometries
- [ ] Dispose all materials
- [ ] Clear tracking arrays

```javascript
window.clearCustomArcs = function() {
  const globe = window.getGlobe();
  if (!globe) return;

  const scene = globe.scene();

  // Dispose all tracked arcs
  animatingArcs.forEach(arc => {
    scene.remove(arc.mesh);
    if (arc.arrowHead) scene.remove(arc.arrowHead);
    arc.geometry.dispose();
    arc.material.dispose();
    if (arc.arrowMaterial) arc.arrowMaterial.dispose();
  });

  animatingArcs = [];

  // Cancel animation loop
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};
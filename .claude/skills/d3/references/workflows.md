# D3 Workflows Reference

## Contents
- Map Initialization Workflow
- Arc Animation Lifecycle
- CDN Data Loading with Fallback
- View Toggle (Globe / Flat Map)
- Dashboard Integration
- Debugging D3 Visualizations

---

## Map Initialization Workflow

### Complete Initialization Sequence

```javascript
// public/js/flat-map-d3.js:96-163 — called from dashboard.html DOMContentLoaded
window.initD3FlatMap = function() {
  // 1. Create container if missing
  const container = document.getElementById('flat-map-container');
  if (!container) {
    const div = document.createElement('div');
    div.id = 'flat-map-container';
    div.style.cssText = 'display: none; position: absolute; top: 0; ...';
    document.body.appendChild(div);
  }

  // 2. Clear previous SVG (idempotent re-init)
  d3.select('#flat-map-container').selectAll('*').remove();

  // 3. Create SVG + projection + path generator
  // 4. Create layer groups (map -> states -> arcs)
  // 5. Load and render country data from CDN
  // 6. Chain: load US states after countries
};
```

Copy this checklist and track progress:
- [ ] Container element exists or is created dynamically
- [ ] Previous SVG cleared via `selectAll('*').remove()`
- [ ] New SVG created with `window.innerWidth` / `window.innerHeight`
- [ ] Equirectangular projection configured with scale and translate
- [ ] Layer groups created in correct order (map, states, arcs)
- [ ] CDN country data loaded with `.catch()` fallback
- [ ] US states loaded after countries (sequential, non-fatal)
- [ ] `mapInitialized` flag set to `true`

---

## Arc Animation Lifecycle

### Three-Phase Arc: Flash -> Travel -> Impact

The D3 arc mirrors the 3D globe arc behavior from `custom-arcs.js`. See the **three-js** skill for the globe-side equivalent.

```
Phase 1: Flash (500ms)        Phase 2: Arc Travel (2500ms)      Phase 3: Impact (700ms)
+--------------------+        +------------------------+        +------------------+
| Pulsing circle at  |-300ms->| Traveling segment with |-done-->| Expanding ring   |
| source location    |  delay | arrow head on bezier   |        | at destination   |
+--------------------+        +------------------------+        +------------------+
```

```javascript
// public/js/flat-map-d3.js:233-285
window.addD3Arc = function(srcLat, srcLng, dstLat, dstLng, color) {
  const source = projection([srcLng, srcLat]);  // Note: [lng, lat] order
  const target = projection([dstLng, dstLat]);

  // Phase 1: Pulsing flash (4 pulses over 500ms)
  const flash = arcsGroup.append('circle')
    .attr('cx', source[0]).attr('cy', source[1])
    .attr('r', 5).attr('fill', flashColor).attr('opacity', 0.9);

  // Phase 2: Arc after 800ms delay (flash + fade)
  setTimeout(function() { drawArc(source, target, color); }, 800);
};
```

### Arc Geometry: Quadratic Bezier

```javascript
// public/js/flat-map-d3.js:294-311
const dx = target[0] - source[0];
const dy = target[1] - source[1];
const distance = Math.sqrt(dx * dx + dy * dy);

// Control point above midpoint — height proportional to distance, max 150px
const arcHeight = Math.min(distance * 0.4, 150);
const controlX = (source[0] + target[0]) / 2;
const controlY = (source[1] + target[1]) / 2 - arcHeight;

// SVG quadratic bezier path (invisible reference for getPointAtLength)
const fullArcPath = `M${source[0]},${source[1]} Q${controlX},${controlY} ${target[0]},${target[1]}`;
```

### Cleanup on Animation Complete

```javascript
// public/js/flat-map-d3.js:379-410 — all 3 elements must be removed
arc.transition().duration(400).attr('opacity', 0).remove();
arrow.transition().duration(400).attr('opacity', 0).remove();
refPath.remove();  // Invisible reference path — easy to forget

// Impact ripple at destination
const impact = arcsGroup.append('circle')
  .attr('cx', target[0]).attr('cy', target[1])
  .attr('r', 3).attr('fill', color[0]).attr('opacity', 0.9);

impact.transition().duration(300).attr('r', 15).attr('opacity', 0.6)
  .transition().duration(400).attr('r', 25).attr('opacity', 0).remove();
```

---

## CDN Data Loading with Fallback

### Primary: World Countries (110m resolution)

```javascript
d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(function(world) {
    const countries = topojson.feature(world, world.objects.countries);
    // Render countries...
    loadUSStates();  // Chain: load states after countries succeed
  })
  .catch(function(error) {
    drawSimpleContinents();  // Fallback to hardcoded rectangles
  });
```

### Secondary: US States (10m resolution, optional)

```javascript
d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
  .then(function(us) {
    const states = topojson.feature(us, us.objects.states);
    // Render state boundaries (fill: none, stroke only)
  })
  .catch(function(error) {
    console.warn('Could not load US states data:', error);  // Non-fatal
  });
```

### Fallback: Simplified Continent Rectangles

```javascript
// public/js/flat-map-d3.js:198-228
function drawSimpleContinents() {
  const continents = [
    { name: 'North America', points: [[-130, 70], [-130, 25], [-60, 25], [-60, 70], [-130, 70]] },
    // ... 5 more continent rectangles
  ];

  continents.forEach(continent => {
    const coords = continent.points.map(p => projection(p));
    mapGroup.append('path')
      .attr('d', d3.line()(coords) + 'Z')
      .attr('fill', '#001a33')
      .attr('stroke', '#00ffff');
  });
  mapInitialized = true;
}
```

---

## View Toggle (Globe / Flat Map)

### Dashboard Toggle Wiring

```javascript
// public/dashboard.html:160-183
toggleBtn.addEventListener('click', function() {
  if (currentView === 'globe') {
    globeContainer.style.display = 'none';
    window.startD3FlatMap();           // Show flat map, attach resize
    currentView = 'flat';
  } else {
    window.stopD3FlatMap();            // Hide flat map, detach resize
    globeContainer.style.display = 'block';
    currentView = 'globe';
  }
});
```

### Both Views Receive Events Simultaneously

```javascript
// public/js/dashboard-client.js:69-95
if (window.addAttackArc) window.addAttackArc(data);     // Globe arcs
if (window.addD3Arc) {                                    // Flat map arcs
  const color = window.getCountryColorRgba(countryCode);
  window.addD3Arc(srcLat, srcLng, dstLat, dstLng, color);
}
```

Only the visible view renders — the hidden view's functions check `mapInitialized` and `arcsGroup` before drawing. See the **websocket** skill for event delivery details.

---

## Debugging D3 Visualizations

### Inspect Projection Output

```javascript
// Verify OCDE location projects correctly
const testPoint = projection([-117.8705, 33.7490]);
console.log('OCDE projects to:', testPoint);  // Should be valid [x, y] within viewport
```

### Check Active Arc Element Count

```javascript
const arcElements = arcsGroup.selectAll('*').size();
console.log('Active arc elements:', arcElements);  // Should not grow unbounded
```

### Test Arc Manually

```javascript
window.addD3Arc(39.9, 116.4, 33.7, -117.9, ['rgba(255,0,0,0.8)', 'rgba(255,0,0,0.6)']);
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Map not visible | Container `display: none` | Call `startD3FlatMap()` |
| Countries missing | CDN failed silently | Check browser network tab |
| Arcs in wrong location | Lat/lng order swapped | Use `[lng, lat]` for `projection()` |
| Growing memory usage | SVG elements not removed | Verify `.remove()` on all elements |
| Resize breaks layout | Projection not recalculated | Confirm `handleResize` listener active |
| States not showing | CDN failed (non-fatal) | Check `statesGroup` exists |

### Feedback Loop for Arc Issues

1. Add test arc with known coordinates (China -> OCDE)
2. Verify source flash appears at correct location
3. If flash works but arc doesn't, check `setTimeout` delay and `drawArc`
4. If arc renders but arrow misaligned, check `getPointAtLength` math
5. Verify all elements removed after animation completes (check `arcsGroup.selectAll('*').size()`)
6. Repeat until arc lifecycle is correct

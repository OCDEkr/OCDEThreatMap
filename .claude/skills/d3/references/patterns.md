# D3 Patterns Reference

## Contents
- Geographic Projections
- SVG Structure and Layering
- Data Binding with GeoJSON
- Transition and requestAnimationFrame Animations
- Country Color Coordination
- Resize Handling

---

## Geographic Projections

### Equirectangular Projection (Current Implementation)

```javascript
// public/js/flat-map-d3.js:120-125
projection = d3.geoEquirectangular()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2])
  .center([0, 0]);  // Prime meridian, equator

path = d3.geoPath(projection);
```

**Why Equirectangular:** Shows full world without cutoff at antimeridian. Mercator distorts polar regions and clips at 180°/-180°.

### WARNING: Coordinate Order Matters

**The Problem:**

```javascript
// BAD - geographic convention (lat, lng)
const point = projection([srcLat, srcLng]);
```

**Why This Breaks:** D3 follows GeoJSON spec: coordinates are `[longitude, latitude]`. Swapping causes points to render in completely wrong locations — a common source of arcs appearing to originate from the ocean.

**The Fix:**

```javascript
// GOOD - D3/GeoJSON convention (lng, lat)
const source = projection([srcLng, srcLat]);
const target = projection([dstLng, dstLat]);
```

**When You Might Be Tempted:** Every time you receive data from the enrichment pipeline (`data.geo.latitude`, `data.geo.longitude`) — the natural instinct is lat-first.

---

## SVG Structure and Layering

### Layer Groups for Z-Index Control

```javascript
// public/js/flat-map-d3.js:128-130 — order determines visual stacking
const mapGroup = svg.append('g').attr('class', 'map-group');      // Bottom: countries
statesGroup = svg.append('g').attr('class', 'states-group');       // Middle: US states
arcsGroup = svg.append('g').attr('class', 'arcs-group');           // Top: attack animations
```

**Why:** SVG renders in document order (no CSS z-index). Arc animations must render above country fills and borders.

### WARNING: Clearing SVG Elements

**The Problem:**

```javascript
// BAD - removes the container itself
d3.select('#flat-map-container').remove();
```

**Why This Breaks:** Removes the DOM container, breaking subsequent `initD3FlatMap()` calls. The container is created once and reused.

**The Fix:**

```javascript
// GOOD - clears children, preserves container
d3.select('#flat-map-container').selectAll('*').remove();
```

---

## Data Binding with GeoJSON

### Enter Pattern for Country Rendering

```javascript
// public/js/flat-map-d3.js:139-147
mapGroup.selectAll('path')
  .data(countries.features)
  .enter()
  .append('path')
  .attr('d', path)
  .attr('fill', '#001a33')    // Dark landmasses (NOC theme)
  .attr('stroke', '#00ffff')  // Cyan borders
  .attr('stroke-width', 0.5)
  .attr('opacity', 0.9);
```

See the **frontend-design** skill for the full NOC color palette.

### TopoJSON to GeoJSON Conversion

```javascript
// REQUIRED: topojson library loaded from CDN before flat-map-d3.js
const countries = topojson.feature(world, world.objects.countries);
const states = topojson.feature(us, us.objects.states);
```

**Why TopoJSON:** ~80% smaller than GeoJSON. CDN serves `world-atlas@2` (countries) and `us-atlas@3` (states).

### US States as Optional Overlay

```javascript
// public/js/flat-map-d3.js:176-186 — thinner, semi-transparent borders
statesGroup.selectAll('path')
  .data(states.features)
  .enter()
  .append('path')
  .attr('d', path)
  .attr('fill', 'none')
  .attr('stroke', '#00ffff')
  .attr('stroke-width', 0.3)
  .attr('stroke-opacity', 0.5)
  .attr('class', 'us-state');
```

**Failure mode:** US states load after countries. CDN failure is non-fatal (`console.warn`, not `console.error`).

---

## Transition and requestAnimationFrame Animations

### Chained Transitions for Source Flash

```javascript
// public/js/flat-map-d3.js:255-279 — 4-pulse flash effect
flash.transition()
  .duration(125).attr('r', 10).attr('opacity', 0.7)
  .transition()
  .duration(125).attr('r', 7).attr('opacity', 0.9)
  .transition()
  .duration(125).attr('r', 12).attr('opacity', 0.6)
  .transition()
  .duration(125).attr('r', 8).attr('opacity', 0.5)
  .on('end', function() {
    d3.select(this).transition().duration(300).attr('opacity', 0).remove();
  });
```

### Traveling Arc via requestAnimationFrame

The arc animation does NOT use D3 transitions. It uses `requestAnimationFrame` with an invisible SVG reference path for `getPointAtLength()`:

```javascript
// public/js/flat-map-d3.js:343-414
function animateArc() {
  const progress = Math.min(elapsed / arcDuration, 1);
  const headPos = progress * pathLength;
  const tailPos = Math.max(0, headPos - (pathLength * 0.35));

  // Sample 20 points along the visible segment
  let pathD = '';
  for (let i = 0; i <= 20; i++) {
    const t = tailPos + (segmentLength * i / 20);
    const pt = refPath.node().getPointAtLength(t);
    pathD += i === 0 ? `M${pt.x},${pt.y}` : ` L${pt.x},${pt.y}`;
  }
  arc.attr('d', pathD);

  // Position arrow at head using tangent for rotation
  const headPoint = refPath.node().getPointAtLength(headPos);
  const nextPoint = refPath.node().getPointAtLength(Math.min(headPos + 3, pathLength));
  const angle = Math.atan2(nextPoint.y - headPoint.y, nextPoint.x - headPoint.x) * 180 / Math.PI + 90;
  arrow.attr('transform', `translate(${headPoint.x},${headPoint.y}) rotate(${angle})`);

  requestAnimationFrame(animateArc);
}
```

See the **three-js** skill for the equivalent 3D arc animation in `custom-arcs.js`.

### WARNING: Memory Leaks from Orphaned Elements

**The Problem:**

```javascript
// BAD - element persists invisible after animation
arc.transition().duration(1000).attr('opacity', 0);
```

**Why This Breaks:** SVG elements accumulate without removal. Under high attack volume (100+ events/sec), thousands of invisible elements degrade browser performance.

**The Fix:**

```javascript
// GOOD - remove after fade, also remove reference path
arc.transition().duration(400).attr('opacity', 0).remove();
arrow.transition().duration(400).attr('opacity', 0).remove();
refPath.remove();
```

---

## Country Color Coordination

The D3 flat map and 3D globe share the same color scheme. Colors are duplicated in two files:

| File | Format | Used By |
|------|--------|---------|
| `public/js/flat-map-d3.js` | `'#ff0000'` (CSS hex) | D3 SVG fills and strokes |
| `public/js/custom-arcs.js` | `0xff0000` (JS hex number) | Three.js material colors |

**WARNING:** These maps must stay synchronized. Adding a country to one file without the other causes inconsistent colors between globe and flat map views.

---

## Resize Handling

### Update Projection on Window Resize

```javascript
// public/js/flat-map-d3.js:454-471
function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  svg.attr('width', width).attr('height', height);

  projection
    .scale(width / 2 / Math.PI)
    .translate([width / 2, height / 2]);

  // Redraw all geographic paths with updated projection
  svg.selectAll('.map-group path').attr('d', path);
}
```

### WARNING: Resize Listener Lifecycle

```javascript
// GOOD - add/remove listener with view toggle
window.startD3FlatMap = function() {
  window.addEventListener('resize', handleResize);
};

window.stopD3FlatMap = function() {
  window.removeEventListener('resize', handleResize);
};
```

**Why:** Leaving the listener active when globe view is showing causes unnecessary projection recalculations on every resize.

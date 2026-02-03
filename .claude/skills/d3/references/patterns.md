# D3 Patterns Reference

## Contents
- Geographic Projections
- SVG Structure and Layering
- Data Binding with GeoJSON
- Transition Animations
- Gradient Definitions
- Resize Handling

---

## Geographic Projections

### Equirectangular Projection (Current Implementation)

```javascript
// public/js/flat-map-d3.js:47-52
projection = d3.geoEquirectangular()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2])
  .center([0, 0]);  // Prime meridian, equator

path = d3.geoPath(projection);
```

**Why Equirectangular:** Shows the full world without cutoff at antimeridian. Mercator distorts polar regions and cuts at 180°/-180°.

### WARNING: Coordinate Order Matters

```javascript
// BAD - lat/lng order (geographic convention)
const point = projection([lat, lng]);

// GOOD - lng/lat order (D3 convention)
const point = projection([lng, lat]);
```

**Why This Breaks:** D3 follows GeoJSON spec where coordinates are `[longitude, latitude]`. Swapping causes points to render in wrong locations.

---

## SVG Structure and Layering

### Layer Groups for Z-Index Control

```javascript
// public/js/flat-map-d3.js:54-57
const mapGroup = svg.append('g').attr('class', 'map-group');      // Bottom
statesGroup = svg.append('g').attr('class', 'states-group');       // Middle
arcsGroup = svg.append('g').attr('class', 'arcs-group');           // Top
```

**Why:** SVG renders in document order. Arc animations must appear above country boundaries.

### WARNING: Clearing SVG Elements

```javascript
// BAD - removes the entire SVG
d3.select('#container').remove();

// GOOD - clears children, keeps container
d3.select('#flat-map-container').selectAll('*').remove();
```

---

## Data Binding with GeoJSON

### Enter Pattern for Initial Render

```javascript
// public/js/flat-map-d3.js:66-74
mapGroup.selectAll('path')
  .data(countries.features)
  .enter()
  .append('path')
  .attr('d', path)
  .attr('fill', '#001a33')
  .attr('stroke', '#00ffff')
  .attr('stroke-width', 0.5)
  .attr('opacity', 0.9);
```

### TopoJSON to GeoJSON Conversion

```javascript
// REQUIRED: topojson library must be loaded
const countries = topojson.feature(world, world.objects.countries);
```

**Why:** TopoJSON is 80% smaller than GeoJSON. CDN provides TopoJSON format.

### WARNING: Missing TopoJSON Library

```javascript
// BAD - crashes if topojson not loaded
const countries = topojson.feature(world, world.objects.countries);

// GOOD - check availability
if (typeof topojson === 'undefined') {
  console.error('TopoJSON library not loaded');
  return;
}
const countries = topojson.feature(world, world.objects.countries);
```

---

## Transition Animations

### Chained Transitions for Pulsing

```javascript
// public/js/flat-map-d3.js:183-206
flash.transition()
  .duration(125).attr('r', 10).attr('opacity', 0.7)
  .transition()
  .duration(125).attr('r', 7).attr('opacity', 0.9)
  .transition()
  .duration(125).attr('r', 12).attr('opacity', 0.6)
  .transition()
  .duration(125).attr('r', 8).attr('opacity', 0.5)
  .on('end', function() {
    d3.select(this)
      .transition()
      .duration(300)
      .attr('opacity', 0)
      .remove();
  });
```

### Arc Fade-In and Fade-Out

```javascript
// public/js/flat-map-d3.js:257-266
arc.transition()
  .duration(500).attr('opacity', 0.8)    // Fade in
  .transition()
  .duration(2000).attr('opacity', 0.3)   // Hold
  .transition()
  .duration(1000).attr('opacity', 0)     // Fade out
  .remove();                              // Cleanup
```

### WARNING: Memory Leaks from Orphaned Elements

```javascript
// BAD - element persists after animation
arc.transition().duration(1000).attr('opacity', 0);

// GOOD - remove after fade completes
arc.transition().duration(1000).attr('opacity', 0).remove();
```

**Why:** SVG elements accumulate without `.remove()`, degrading performance.

---

## Gradient Definitions

### Linear Gradient for Arc Stroke

```javascript
// public/js/flat-map-d3.js:230-245
const gradientId = 'arc-gradient-' + Date.now() + '-' + Math.random();

const gradient = svg.append('defs')
  .append('linearGradient')
  .attr('id', gradientId)
  .attr('x1', '0%').attr('y1', '0%')
  .attr('x2', '100%').attr('y2', '0%');

gradient.append('stop')
  .attr('offset', '0%')
  .attr('stop-color', color[0]);

gradient.append('stop')
  .attr('offset', '100%')
  .attr('stop-color', color[1]);

// Apply gradient
arc.attr('stroke', `url(#${gradientId})`);
```

**Why unique IDs:** Multiple arcs with same gradient ID cause visual glitches.

---

## Resize Handling

### Update Projection on Window Resize

```javascript
// public/js/flat-map-d3.js:324-341
function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  svg.attr('width', width).attr('height', height);

  projection
    .scale(width / 2 / Math.PI)
    .translate([width / 2, height / 2]);

  // Redraw all paths with new projection
  svg.selectAll('.map-group path').attr('d', path);
}
```

### WARNING: Resize Listener Cleanup

```javascript
// BAD - listener persists after component unmount
window.addEventListener('resize', handleResize);

// GOOD - remove when stopping flat map
window.startD3FlatMap = function() {
  window.addEventListener('resize', handleResize);
};

window.stopD3FlatMap = function() {
  window.removeEventListener('resize', handleResize);
};
```
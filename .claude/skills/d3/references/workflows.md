# D3 Workflows Reference

## Contents
- Map Initialization Workflow
- Arc Animation Lifecycle
- CDN Data Loading
- View Toggle (Globe ↔ Flat Map)
- Debugging D3 Visualizations

---

## Map Initialization Workflow

### Complete Initialization Sequence

```javascript
// 1. Create container if needed
const container = document.getElementById('flat-map-container');
if (!container) {
  const mapContainer = document.createElement('div');
  mapContainer.id = 'flat-map-container';
  mapContainer.style.cssText = 'display: none; position: absolute; ...';
  document.body.appendChild(mapContainer);
}

// 2. Clear previous SVG
d3.select('#flat-map-container').selectAll('*').remove();

// 3. Create SVG with dimensions
svg = d3.select('#flat-map-container')
  .append('svg')
  .attr('width', window.innerWidth)
  .attr('height', window.innerHeight);

// 4. Create projection and path generator
projection = d3.geoEquirectangular()...
path = d3.geoPath(projection);

// 5. Create layer groups
const mapGroup = svg.append('g').attr('class', 'map-group');
arcsGroup = svg.append('g').attr('class', 'arcs-group');

// 6. Load and render country data
d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(renderCountries)
  .catch(drawFallback);
```

Copy this checklist and track progress:
- [ ] Container element exists or created
- [ ] Previous SVG cleared
- [ ] New SVG created with correct dimensions
- [ ] Projection configured
- [ ] Layer groups created in correct order
- [ ] CDN data loaded with error fallback

---

## Arc Animation Lifecycle

### Phased Arc Animation (Source Flash → Arc Draw → Fade Out)

```javascript
window.addD3Arc = function(srcLat, srcLng, dstLat, dstLng, color) {
  // Phase 1: Project coordinates
  const source = projection([srcLng, srcLat]);
  const target = projection([dstLng, dstLat]);

  // Phase 2: Create and animate source flash (500ms)
  const flash = arcsGroup.append('circle')
    .attr('cx', source[0])
    .attr('cy', source[1])
    .attr('r', 5)
    .attr('fill', color[0]);

  flash.transition()
    .duration(500)
    .attr('r', 12)
    .on('end', function() {
      d3.select(this).transition().duration(300).attr('opacity', 0).remove();
    });

  // Phase 3: Draw arc after delay (800ms total)
  setTimeout(function() {
    drawArc(source, target, color);
  }, 800);
};
```

### Arc Drawing with SVG Path

```javascript
function drawArc(source, target, color) {
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  const dr = Math.sqrt(dx * dx + dy * dy);
  const sweep = dx > 0 ? 1 : 0;

  // SVG arc path
  const arcPath = `M${source[0]},${source[1]} A${dr},${dr} 0 0,${sweep} ${target[0]},${target[1]}`;

  // Create gradient, draw arc, animate
  const arc = arcsGroup.append('path')
    .attr('d', arcPath)
    .attr('fill', 'none')
    .attr('stroke', `url(#${gradientId})`)
    .attr('stroke-width', 2)
    .attr('opacity', 0);

  // 3-phase animation: fade in → hold → fade out → remove
  arc.transition().duration(500).attr('opacity', 0.8)
    .transition().duration(2000).attr('opacity', 0.3)
    .transition().duration(1000).attr('opacity', 0)
    .remove();
}
```

---

## CDN Data Loading

### Load World Countries with Fallback

```javascript
// Primary: CDN TopoJSON
d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(function(world) {
    const countries = topojson.feature(world, world.objects.countries);
    renderCountries(countries.features);
  })
  .catch(function(error) {
    console.error('CDN failed:', error);
    drawSimpleContinents();  // Fallback to hardcoded shapes
  });
```

### Load US States (Optional Layer)

```javascript
// After countries load
d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
  .then(function(us) {
    const states = topojson.feature(us, us.objects.states);
    statesGroup.selectAll('path')
      .data(states.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#00ffff')
      .attr('stroke-width', 0.3);
  })
  .catch(function(error) {
    console.warn('US states optional:', error);  // Non-fatal
  });
```

### Fallback: Simplified Continent Shapes

```javascript
// public/js/flat-map-d3.js:125-155
function drawSimpleContinents() {
  const continents = [
    { name: 'North America', points: [[-130, 70], [-130, 25], [-60, 25], [-60, 70], [-130, 70]] },
    // ... more continents
  ];

  continents.forEach(continent => {
    const coordinates = continent.points.map(p => projection(p));
    mapGroup.append('path')
      .attr('d', d3.line()(coordinates) + 'Z')
      .attr('fill', '#001a33')
      .attr('stroke', '#00ffff');
  });
}
```

---

## View Toggle (Globe ↔ Flat Map)

### Start Flat Map View

```javascript
window.startD3FlatMap = function() {
  const container = document.getElementById('flat-map-container');
  if (container) {
    container.style.display = 'block';
  }

  if (!mapInitialized) {
    window.initD3FlatMap();
  }

  window.addEventListener('resize', handleResize);
};
```

### Stop Flat Map View

```javascript
window.stopD3FlatMap = function() {
  const container = document.getElementById('flat-map-container');
  if (container) {
    container.style.display = 'none';
  }

  window.removeEventListener('resize', handleResize);
};
```

### Clear All Arcs

```javascript
window.clearD3Arcs = function() {
  if (arcsGroup) {
    arcsGroup.selectAll('*').remove();
  }
};
```

---

## Debugging D3 Visualizations

### Inspect Projection Output

```javascript
// Check if coordinates project correctly
const testPoint = projection([-117.8705, 33.7490]);  // OCDE location
console.log('OCDE projects to:', testPoint);  // Should be valid [x, y]
```

### Verify Data Binding

```javascript
// Check how many elements were created
const pathCount = mapGroup.selectAll('path').size();
console.log('Countries rendered:', pathCount);  // Should match feature count
```

### Debug Arc Path Generation

```javascript
// Log the SVG path string
console.log('Arc path:', arcPath);  // Should be valid M...A... path
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Map not visible | Container `display: none` | Call `startD3FlatMap()` |
| Countries missing | CDN failed, no fallback | Check network, add fallback |
| Arcs in wrong location | Lat/lng order swapped | Use `[lng, lat]` for D3 |
| Memory leak | Elements not removed | Add `.remove()` after transitions |
| Resize breaks layout | Projection not updated | Recalculate scale/translate |

### Feedback Loop for Arc Issues

1. Add arc with test coordinates
2. Verify projection output is valid [x, y]
3. If arc not visible, check arcsGroup exists
4. If animation fails, check transition chain
5. Repeat until arc renders correctly
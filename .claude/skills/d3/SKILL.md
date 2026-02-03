---
name: d3
description: |
  Renders 2D flat map visualizations with geographic projections and data-driven graphics.
  Use when: Creating flat map views, rendering country boundaries from TopoJSON, animating SVG elements, building data-driven visualizations, or working with geographic projections.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# D3 Skill

D3.js handles the 2D flat map alternative to the 3D globe visualization. This project uses D3 specifically for geographic projections (Equirectangular), loading TopoJSON country/state data from CDN, and animating attack arcs via SVG. D3 v7.8.5 is loaded from unpkg CDN alongside topojson v3.0.2 for GeoJSON conversion.

## Quick Start

### Initialize D3 Flat Map

```javascript
// public/js/flat-map-d3.js:23-52
window.initD3FlatMap = function() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Create SVG container
  svg = d3.select('#flat-map-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', '#000000');

  // Create Equirectangular projection (full world view)
  projection = d3.geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
    .center([0, 0]);

  path = d3.geoPath(projection);
};
```

### Load TopoJSON and Render Countries

```javascript
// public/js/flat-map-d3.js:60-87
d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(function(world) {
    const countries = topojson.feature(world, world.objects.countries);

    mapGroup.selectAll('path')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', '#001a33')
      .attr('stroke', '#00ffff')
      .attr('stroke-width', 0.5);
  })
  .catch(function(error) {
    drawSimpleContinents();  // Fallback on CDN failure
  });
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Projection | Convert lat/lng to SVG coordinates | `d3.geoEquirectangular()` |
| Path Generator | Convert GeoJSON to SVG path `d` attribute | `d3.geoPath(projection)` |
| Data Binding | Join data to DOM elements | `.data(features).enter().append('path')` |
| Transitions | Animate SVG properties over time | `.transition().duration(500).attr('opacity', 0)` |
| Gradients | Define SVG gradient fills | `svg.append('defs').append('linearGradient')` |

## Common Patterns

### Animate Attack Arc with Phased Animation

**When:** Displaying attack origin-to-destination arcs with flash effect

```javascript
// public/js/flat-map-d3.js:167-212
window.addD3Arc = function(srcLat, srcLng, dstLat, dstLng, color) {
  const source = projection([srcLng, srcLat]);
  const target = projection([dstLng, dstLat]);

  // Phase 1: Flash at source
  const flash = arcsGroup.append('circle')
    .attr('cx', source[0])
    .attr('cy', source[1])
    .attr('r', 5)
    .attr('fill', color[0]);

  // Chained transitions for pulsing effect
  flash.transition()
    .duration(125).attr('r', 10)
    .transition()
    .duration(125).attr('r', 7)
    .on('end', function() {
      d3.select(this).transition().duration(300).attr('opacity', 0).remove();
    });

  // Phase 2: Draw arc after delay
  setTimeout(function() { drawArc(source, target, color); }, 800);
};
```

## See Also

- [patterns](references/patterns.md) - SVG manipulation, projections, data binding
- [workflows](references/workflows.md) - Map initialization, arc lifecycle, resize handling

## Related Skills

- See the **three-js** skill for 3D globe visualization (primary view)
- See the **globe-gl** skill for the high-level globe API
- See the **websocket** skill for receiving real-time attack events
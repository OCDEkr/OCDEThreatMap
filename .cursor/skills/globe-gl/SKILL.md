All three globe-gl skill files have been generated:

| File | Lines | Content |
|------|-------|---------|
| `SKILL.md` | 108 | Globe init, polygon borders, Three.js internals, file map, related skills |
| `references/patterns.md` | 261 | Coordinate conversion, TubeGeometry arcs, polygon layers, country colors, 3 anti-patterns with WARNING format |
| `references/workflows.md` | 293 | Full initialization checklist, arc lifecycle (3-phase animation), view switching, rotation, cleanup checklist, new layer validation |

**Key content highlights:**
- Accurate line references to actual source files (`public/js/custom-arcs.js:271`, etc.)
- Documented the country-based color system (not threat-type based) with sync warning for `flat-map-d3.js`
- Three WARNING anti-patterns: coordinate formula mismatch, GPU memory leaks, full devicePixelRatio
- Script load order from actual `dashboard.html`
- Cross-references to **three-js**, **d3**, **websocket**, and **frontend-design** skills
- Checklists for initialization (8 steps) and cleanup (5 steps)
- Iterate-until-pass validation pattern for adding new visualization layers
- 18+ code blocks across all files
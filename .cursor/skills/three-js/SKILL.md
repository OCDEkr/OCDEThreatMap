All three **three-js** skill files have been generated successfully:

| File | Lines | Size | Description |
|------|-------|------|-------------|
| `SKILL.md` | 94 | 4KB | Quick overview, key concepts, file map, performance constants, critical rules |
| `references/patterns.md` | 279 | 7.6KB | Geometry, materials, animation, scene integration, memory management, adaptive sampling |
| `references/workflows.md` | 254 | 7.7KB | Object addition workflow, performance optimization, coordinate system, lifecycle, debugging |

### Key Content

- **6 WARNING anti-patterns** documented with problem/why/fix structure: specular highlights, animation without cleanup, missing dispose, background color override, incorrect longitude formula, thin lines
- **20+ code blocks** across all files, drawn from actual codebase (`custom-arcs.js`, `globe.js`, `performance-monitor.js`)
- **Accurate constants** reflecting current values (64/6 segments, 150 max arcs, 2000ms duration, 100/sec threshold)
- **COUNTRY_COLORS** documentation (hex int format, keep in sync with D3 flat map)
- **Cross-references** to **globe-gl**, **d3**, and **frontend-design** skills
- **Workflow checklists** for adding objects and debugging visibility issues
- **Feedback loop** pattern for FPS-based progressive quality degradation
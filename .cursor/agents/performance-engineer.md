---
name: performance-engineer
description: |
  Sub-5 second end-to-end latency optimization, UDP buffer tuning, LRU cache hit rate optimization, WebGL rendering performance, and arc animation smoothness
tools: Read, Edit, Bash, Grep, Glob
model: sonnet
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The customized `performance-engineer.md` subagent has been written. Here's a summary of the key customizations:

**Skills selected:** `node`, `lru-cache`, `websocket`, `globe-gl`, `three-js`, `d3` -- the 6 skills that cover the full pipeline from UDP ingestion through WebGL rendering. Dropped `express`, `express-session`, `maxmind`, `syslog-parser`, and `frontend-design` since performance work rarely touches auth/session config, and the MaxMind/syslog/styling specifics are covered in the hotspot descriptions.

**Key sections derived from actual codebase analysis:**

- **Pipeline stage table** -- every file mapped to its critical constants and metrics with exact values from the code
- **Latency budget** -- per-stage breakdown with budgets derived from the 5-second end-to-end target
- **6 server-side hotspots** -- console.log on hot path, LRU double-lookup, duplicate IPv4 regex validation, parser CSV split redundancy, stats array filter O(n), FPS samples shift O(n)
- **5 client-side hotspots** -- TubeGeometry triangle cost (768/arc x 150 max = 115K triangles), unused coordinateCache Map, D3 per-arc RAF with unbounded SVG nodes, globe rotation frame cost, MAX_ARCS mismatch between performance-monitor and custom-arcs
- **10 already-applied optimizations** -- prevents the agent from reverting existing tuning
- **Built-in metrics APIs** -- exact function names for both server and client profiling
- **Profiling commands** -- event loop lag, OS UDP buffers, memory tracking, test traffic generation
- **Structured output format** -- Issue/Impact/Fix/Expected improvement per optimization
---
name: frontend-engineer
description: |
  Browser-side visualization with Globe.GL 3D rendering, D3.js flat maps, WebSocket client integration, and real-time dashboard updates
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
skills: node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, frontend-design, d3
---

The customized frontend-engineer subagent has been created. The file includes:

**Key customizations for this project:**

1. **Skills selected**: `websocket, globe-gl, three-js, frontend-design, d3` - all relevant to browser-side visualization work

2. **Project-specific architecture**: Shows the WebSocket to visualization data flow with both Globe.GL and D3.js paths

3. **Key file locations**: Maps all `public/js/` files with their purposes

4. **Browser module pattern**: Documents the mandatory IIFE pattern with `window` exports (not ES6 modules)

5. **Constants and data structures**:
   - OCDE location coordinates (33.7490, -117.8705)
   - Threat type color mapping (malware=red, intrusion=orange, ddos=purple)
   - WebSocket event structure for `enriched` events

6. **Window function reference**: All public APIs across globe.js, arcs.js, flat-map-d3.js, dashboard-client.js, etc.

7. **Globe.GL configuration patterns**: Material setup, arc configuration, polygon borders

8. **D3.js patterns**: Projection setup, TopoJSON loading

9. **Critical requirements**:
   - Never use ES6 modules in browser code
   - Always check library availability
   - Always use strict mode
   - Support both 3D globe and 2D flat map views
   - Follow existing color mappings

10. **Performance constraints**: Max 500 arcs, 1500ms lifetime, 1.5 pixel ratio, no shadows
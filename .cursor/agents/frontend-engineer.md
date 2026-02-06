---
name: frontend-engineer
description: |
  Browser-side visualization with Globe.GL 3D rendering, D3.js flat maps, WebSocket client integration, and real-time dashboard updates
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The `frontend-engineer.md` subagent has been generated at `.claude/subagents/frontend-engineer.md`.

**Key customizations for this project:**

- **Skills narrowed to 5**: `websocket, globe-gl, three-js, d3, frontend-design` — dropped all backend-only skills (node, express, express-session, maxmind, syslog-parser, lru-cache)
- **Complete file map** with every `public/js/` file, its `window.*` exports, and purpose
- **Mandatory script load order** (16 entries with dependency annotations)
- **IIFE module pattern** template with enforcement rules
- **WebSocket event flow** diagram showing data path from server through `dashboard-client.js` to both rendering systems
- **Enriched event payload** structure with exact field names
- **Full color system** — design palette (5 roles) + country arc colors with dual-file sync warning
- **Key constants table** with actual values from the codebase (MAX_ARCS, ARC_SEGMENTS, sampling thresholds, etc.)
- **Arc animation lifecycle** — 3-phase (Flash, Travel, Fade) with timing details
- **11 CRITICAL rules** including the coordinate formula pitfall (`theta = 90 - lng`), no-ES-modules mandate, and `ws-client.js` vs `dashboard-client.js` distinction
- **3 common task workflows** (new panel, new viz layer, arc modification) with step-by-step instructions